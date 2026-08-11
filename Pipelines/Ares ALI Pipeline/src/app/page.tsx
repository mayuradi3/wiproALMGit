"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Folder, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type AssetCard = {
  id: string
  name: string
  createdAt: number
}

export default function Home() {
  const router = useRouter()
  const [cards, setCards] = useState<AssetCard[]>([])
  const [open, setOpen] = useState(false)
  const [cardName, setCardName] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem("ali-cards")
    if (stored) setCards(JSON.parse(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem("ali-cards", JSON.stringify(cards))
  }, [cards])

  function addCard() {
    if (!cardName.trim()) return
    const newCard: AssetCard = {
      id: crypto.randomUUID(),
      name: cardName.trim(),
      createdAt: Date.now(),
    }
    setCards((prev) => [newCard, ...prev])
    setCardName("")
    setOpen(false)
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="flex items-center gap-2.5 px-6 py-4 border-b border-border/40">
        <Folder className="size-5 text-foreground" />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          ALI Pipeline
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {cards.length === 0 ? (
          <button
            key="empty"
            onClick={() => setOpen(true)}
            className="flex items-center justify-center size-14 text-muted-foreground hover:text-foreground transition-all duration-300 group animate-in fade-in zoom-in-95 duration-300"
          >
            <Plus className="size-6 transition-all duration-300 group-hover:rotate-[-90deg] group-hover:stroke-[3]" />
          </button>
        ) : (
          <div key="cards" className="w-full max-w-3xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
                Assets
              </h2>
              <button
                onClick={() => setOpen(true)}
                className="flex items-center justify-center size-8 text-muted-foreground hover:text-foreground transition-all duration-300 group"
              >
                <Plus className="size-4 transition-all duration-300 group-hover:rotate-[-90deg] group-hover:stroke-[3]" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <Card
                  key={card.id}
                  size="sm"
                  className="relative group animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/assets/${card.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <CardTitle className="text-sm">{card.name}</CardTitle>
                    <button
                      onClick={() => removeCard(card.id)}
                      className="size-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Create New Asset</DialogTitle>
            <DialogDescription>
              Enter a name for your asset.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addCard()
            }}
          >
            <Input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Asset name"
              autoFocus
              className="mb-4"
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
