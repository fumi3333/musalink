"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { updateUser } from "@/services/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function OnboardingModal() {
    const { user, userData } = useAuth()
    const [open, setOpen] = useState(false)
    const [nickname, setNickname] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Show if logged in, data loaded, but no custom display_name set
        if (user && userData && !userData.isProfileComplete) {
            setOpen(true)
        }
    }, [user, userData])

    // Prevent closing by user interaction if profile is not complete
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && userData && !userData.isProfileComplete) {
            // Do not allow closing
            return; 
        }
        setOpen(newOpen);
    }

    const handleSubmit = async () => {
        if (!nickname.trim()) return
        setLoading(true)
        try {
            await updateUser(user!.uid, { 
                display_name: nickname,
                isProfileComplete: true 
            })
            toast.success("プロフィールを設定しました")
            setOpen(false)
        } catch (e) {
            toast.error("保存に失敗しました")
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>ようこそ Musalink へ！</DialogTitle>
                    <DialogDescription>
                        はじめに、アプリ内で表示するニックネームを設定してください。<br />
                        <span className="text-xs text-slate-500">※本名は入力しないでください。後で変更可能です。</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="nickname">ニックネーム</Label>
                        <Input
                            id="nickname"
                            placeholder="例: むさし"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={!nickname.trim() || loading}>
                        {loading ? "保存中..." : "はじめる"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
