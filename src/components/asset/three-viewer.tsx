"use client"

import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react"
import { Lock } from "lucide-react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { OBJLoader } from "three/addons/loaders/OBJLoader.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { USDLoader } from "three/addons/loaders/USDLoader.js"

export type Textures = {
  baseColor?: string
  emissive?: string
  normal?: string
  orm?: string
}

export type ThreeViewerHandle = {
  captureScreenshot: () => Promise<Blob>
  captureCleanScreenshot: () => Promise<Blob>
  isReady: () => boolean
}

type Props = {
  modelUrl: string | null
  textures: Textures
  fileName: string | null
  onModelLoaded?: () => void
  onModelError?: (msg: string) => void
  onTexturesApplied?: () => void
  farPlane?: number
}

const USD_EXTS = ["usd", "usda", "usdc", "usdz"]
const GLTF_EXTS = ["glb", "gltf"]

export const ThreeViewer = forwardRef<ThreeViewerHandle, Props>(function ThreeViewer(
  { modelUrl, textures, fileName, onModelLoaded, onModelError, onTexturesApplied, farPlane = 100000 },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animIdRef = useRef(0)
  const modelObjRef = useRef<THREE.Object3D | null>(null)
  const modelLoadedRef = useRef(false)
  const groundRef = useRef<THREE.Object3D | null>(null)
  const gridRef = useRef<THREE.Object3D | null>(null)
  const ringRef = useRef<THREE.Object3D | null>(null)
  const axesRef = useRef<THREE.Object3D | null>(null)
  const texturesRef = useRef(textures)
  texturesRef.current = textures
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const onModelLoadedRef = useRef(onModelLoaded)
  onModelLoadedRef.current = onModelLoaded
  const onModelErrorRef = useRef(onModelError)
  onModelErrorRef.current = onModelError
  const onTexturesAppliedRef = useRef(onTexturesApplied)
  onTexturesAppliedRef.current = onTexturesApplied

  useImperativeHandle(ref, () => ({
    captureScreenshot: async () => {
      const r = rendererRef.current
      const s = sceneRef.current
      const c = cameraRef.current
      if (!r || !s || !c) throw new Error("Renderer not ready")
      r.render(s, c)
      return new Promise<Blob>((resolve, reject) => {
        r.domElement.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error("Failed to capture screenshot"))
        }, "image/png")
      })
    },
    captureCleanScreenshot: async () => {
      const r = rendererRef.current
      const s = sceneRef.current
      const c = cameraRef.current
      if (!r || !s || !c) throw new Error("Renderer not ready")

      const studio = [groundRef.current, gridRef.current, ringRef.current, axesRef.current].filter(Boolean) as THREE.Object3D[]
      const oldBg = s.background
      const oldVisible = studio.map((obj) => obj.visible)

      s.background = null
      studio.forEach((obj) => (obj.visible = false))

      r.render(s, c)
      const blob = await new Promise<Blob>((resolve, reject) => {
        r.domElement.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error("Failed to capture clean screenshot"))
        }, "image/png")
      })

      s.background = oldBg
      studio.forEach((obj, i) => (obj.visible = oldVisible[i]))

      return blob
    },
    isReady: () => modelLoadedRef.current,
  }))

  function resetCamera() {
    const c = cameraRef.current
    const controls = controlsRef.current
    const obj = modelObjRef.current
    if (!c || !controls) return
    if (!obj) {
      c.position.set(-5.0, 8.0, 4.4)
      controls.target.set(0, 0, 0)
      controls.update()
      return
    }

    const box = new THREE.Box3().setFromObject(obj)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const r = Math.max(size.x, size.y, size.z) / 2

    const vFov = (c.fov * Math.PI) / 180
    const dist = (r / Math.tan(vFov / 2)) * 2.5

    const dir = new THREE.Vector3(-1, 1, 1).normalize().multiplyScalar(dist)
    c.position.copy(center).add(dir)
    controls.target.copy(center)
    controls.update()
  }

  const setupScene = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (rendererRef.current) return

    const w = container.clientWidth || 800
    const h = container.clientHeight || 600

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, farPlane)
    camera.position.set(-5.0, 8.0, 4.4)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.display = "block"
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.minDistance = 1
    controls.maxDistance = 5000
    controls.target.set(0, 0, 0)
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.DOLLY,
    }

    const coordDisplay = document.createElement("div")
    coordDisplay.style.cssText = "position:absolute;top:10px;left:10px;z-index:1;font-family:monospace;font-size:11px;line-height:1.7;color:#bbb;background:rgba(0,0,0,0.65);padding:6px 10px;border-radius:8px;pointer-events:none;user-select:none;white-space:pre;"
    container.appendChild(coordDisplay)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
    keyLight.position.set(5, 8, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x8899cc, 1.0)
    fillLight.position.set(-4, 3, -2)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.5)
    rimLight.position.set(-2, 5, 8)
    scene.add(rimLight)

    const hemiLight = new THREE.HemisphereLight(0x444466, 0x000000, 0.4)
    scene.add(hemiLight)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    groundRef.current = ground
    scene.add(ground)

    const grid = new THREE.GridHelper(10, 20, 0x333333, 0x222222)
    gridRef.current = grid
    scene.add(grid)

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.22, 1.26, 64),
      new THREE.MeshBasicMaterial({ color: 0x6366f1, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.001
    ringRef.current = ring
    scene.add(ring)

    const axes = new THREE.AxesHelper(1.5)
    axes.position.y = 0.01
    axesRef.current = axes
    scene.add(axes)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    controlsRef.current = controls
    setStatus("")

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      const p = controls.target
      const c = camera.position
      coordDisplay.textContent = `target: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\ncam:    ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`
    }
    animate()
  }, [])

  useEffect(() => {
    setupScene()

    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) continue
        const r = rendererRef.current
        const c = cameraRef.current
        if (r && c) {
          c.aspect = width / height
          c.updateProjectionMatrix()
          r.setSize(width, height)
        }
      }
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animIdRef.current)
      rendererRef.current?.dispose()
      controlsRef.current?.dispose()
      if (container.contains(rendererRef.current?.domElement ?? null)) {
        container.removeChild(rendererRef.current!.domElement)
      }
      rendererRef.current = null
    }
  }, [setupScene])

  const applyTextures = useCallback(() => {
    const obj = modelObjRef.current
    if (!obj) return

    const texLoader = new THREE.TextureLoader()
    const keys: (keyof Textures)[] = ["baseColor", "emissive", "normal", "orm"]
    const active = keys.filter((k) => texturesRef.current[k])
    if (active.length === 0) return

    let loaded = 0
    function checkDone() {
      loaded++
      if (loaded >= active.length) onTexturesAppliedRef.current?.()
    }

    for (const key of active) {
      const url = texturesRef.current[key]!
      texLoader.load(url, (tex) => {
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping

        obj.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          const mat = child.material as THREE.MeshStandardMaterial
          if (key === "baseColor") { mat.map = tex; mat.color.set(0xffffff) }
          else if (key === "emissive") { mat.emissiveMap = tex; mat.emissive.set(0xffffff); mat.emissiveIntensity = 1 }
          else if (key === "normal") { mat.normalMap = tex }
          else if (key === "orm") { mat.aoMap = tex; mat.roughnessMap = tex; mat.metalnessMap = tex }
          mat.needsUpdate = true
        })

        checkDone()
      })
    }
  }, [])

  useEffect(() => {
    applyTextures()
  }, [applyTextures])

  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return
    const scene = sceneRef.current
    setLoading(true)
    setErrorMsg(null)
    setStatus("Loading model...")

    while (scene.children.length > 5) scene.remove(scene.children[scene.children.length - 1])
    modelObjRef.current = null
    modelLoadedRef.current = false

    const ext = fileName?.split(".").pop()?.toLowerCase() || ""
    const isOBJ = ext === "obj"
    const isGLTF = GLTF_EXTS.includes(ext)
    const isUSD = USD_EXTS.includes(ext)

    if (!isOBJ && !isGLTF && !isUSD) {
      const msg = `Unsupported format: .${ext}`
      setLoading(false)
      setStatus("")
      setErrorMsg(msg)
      onModelErrorRef.current?.(msg)
      return
    }

    let loader: THREE.Loader
    if (isUSD) loader = new USDLoader()
    else if (isGLTF) loader = new GLTFLoader()
    else loader = new OBJLoader()

    loader.load(
      modelUrl,
      (result: unknown) => {
        try {
          const loaded = result as THREE.Group & { scene?: THREE.Group }
          const obj = isUSD ? loaded : isGLTF ? (loaded.scene ?? loaded) : loaded

          const box = new THREE.Box3().setFromObject(obj)
          if (box.isEmpty()) {
            const msg = "Model has no visible geometry"
            setLoading(false)
            setStatus("")
            setErrorMsg(msg)
            onModelErrorRef.current?.(msg)
            return
          }

          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(0.001, size.x, size.y, size.z)
          const scale = 3 / maxDim
          obj.position.sub(center)
          obj.scale.setScalar(scale)
          obj.position.y = size.y * scale * 0.5

          obj.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })

          scene.add(obj)
          modelObjRef.current = obj
          modelLoadedRef.current = true
          setLoading(false)
          setStatus("")
          onModelLoadedRef.current?.()
          resetCamera()
          applyTextures()
        } catch (err: unknown) {
          setLoading(false)
          setStatus("")
          const msg = `Process error: ${err instanceof Error ? err.message : String(err)}`
          setErrorMsg(msg)
          onModelErrorRef.current?.(msg)
        }
      },
      undefined,
      (err) => {
        setLoading(false)
        setStatus("")
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(`Load failed: ${msg}`)
        onModelErrorRef.current?.(`Load failed: ${msg}`)
      }
    )
  }, [modelUrl, fileName, applyTextures])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} className="w-full h-full bg-black rounded-xl overflow-hidden" />
      <button
        onClick={resetCamera}
        className="absolute bottom-3 right-3 size-7 flex items-center justify-center rounded-md bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-all border border-white/10"
        title="Reset camera view"
      >
        <Lock className="size-3.5" />
      </button>
    </div>
  )
})