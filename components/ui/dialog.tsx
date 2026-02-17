"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { open?: boolean, onOpenChange?: (open: boolean) => void }>(
    ({ children, open: controlledOpen, onOpenChange, ...props }, ref) => {
        const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
        const isControlled = controlledOpen !== undefined
        const open = isControlled ? controlledOpen : uncontrolledOpen
        const setOpen = isControlled ? onOpenChange : setUncontrolledOpen

        // Context provider structure could be added here if needed for Trigger/Content decoupling in a complex app.
        // For this simple implementation, we assume Trigger and Content are used within this scope or we use a Context.

        return (
            <DialogContext.Provider value={{ open: !!open, setOpen: setOpen as any }}>
                <div ref={ref} {...props}>
                    {children}
                </div>
            </DialogContext.Provider>
        )
    }
)
Dialog.displayName = "Dialog"

// Context
interface DialogContextType {
    open: boolean
    setOpen: (open: boolean) => void
}
const DialogContext = React.createContext<DialogContextType | undefined>(undefined)

const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
    ({ className, onClick, asChild, ...props }, ref) => {
        const context = React.useContext(DialogContext)
        if (!context) throw new Error("DialogTrigger must be used within Dialog")

        // If asChild is true, we should clone the child and pass props. 
        // Here we implement a simplified version that wraps if not asChild, or clones if possible.
        // To match Shadcn 'asChild', we usually need @radix-ui/react-slot.
        // We'll assume the child is a button-like element and `onClick` works.

        // Simplification: We wrap it in a div or clone it? 
        // Let's just render the child and attach onClick cloneElement.
        const child = React.Children.only(props.children) as React.ReactElement<any>;

        return React.cloneElement(child, {
            onClick: (e: React.MouseEvent) => {
                child.props.onClick?.(e);
                context.setOpen(true);
            },
            ref
        });
    }
)
DialogTrigger.displayName = "DialogTrigger"

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        const context = React.useContext(DialogContext)
        if (!context?.open) return null

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in-0"
                    onClick={() => context.setOpen(false)}
                />
                {/* Content */}
                <div
                    ref={ref}
                    className={cn(
                        "relative z-50 grid w-full max-w-lg gap-4 border bg-white p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg md:w-full",
                        className
                    )}
                    {...props}
                >
                    {children}
                    <button
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 data-[state=open]:text-slate-500"
                        onClick={() => context.setOpen(false)}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </button>
                </div>
            </div>
        )
    }
)
DialogContent.displayName = "DialogContent"

// Header/Title/Description helpers (simple divs)
const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-1.5 text-center sm:text-left",
            className
        )}
        {...props}
    />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("text-sm text-slate-500", className)}
        {...props}
    />
))
DialogDescription.displayName = "DialogDescription"

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
DialogFooter.displayName = "DialogFooter"

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
