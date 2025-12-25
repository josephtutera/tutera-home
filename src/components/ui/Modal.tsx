"use client";

import { forwardRef, Fragment } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { IconButton } from "./Button";

interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showClose?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({
    open,
    onOpenChange,
    trigger,
    title,
    description,
    children,
    size = "md",
    showClose = true,
    className = "",
  }, ref) => {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div
                  ref={ref}
                  className={`
                    fixed left-1/2 top-1/2 z-50
                    w-[calc(100%-2rem)] ${sizeMap[size]}
                    bg-[var(--surface)] rounded-[var(--radius-lg)]
                    shadow-[var(--shadow-lg)]
                    p-6
                    focus:outline-none
                    ${className}
                  `}
                  initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
                  animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                  exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {(title || showClose) && (
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        {title && (
                          <Dialog.Title className="text-lg font-semibold text-[var(--text-primary)]">
                            {title}
                          </Dialog.Title>
                        )}
                        {description && (
                          <Dialog.Description className="text-sm text-[var(--text-secondary)] mt-1">
                            {description}
                          </Dialog.Description>
                        )}
                      </div>
                      {showClose && (
                        <Dialog.Close asChild>
                          <IconButton
                            icon={<X className="w-4 h-4" />}
                            variant="ghost"
                            size="sm"
                            aria-label="Close"
                            className="shrink-0 -mr-2 -mt-2"
                          />
                        </Dialog.Close>
                      )}
                    </div>
                  )}
                  {children}
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    );
  }
);

Modal.displayName = "Modal";

// Modal Footer for action buttons
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter = ({ children, className = "" }: ModalFooterProps) => {
  return (
    <div className={`flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)] ${className}`}>
      {children}
    </div>
  );
};

export default Modal;

