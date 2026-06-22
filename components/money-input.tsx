"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { formatNumber } from "@/lib/format"

interface MoneyInputProps {
  value: number
  onChange: (value: number) => void
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function MoneyInput({
  value,
  onChange,
  id,
  className,
  placeholder,
  disabled,
}: MoneyInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d]/g, "")
    onChange(digits ? Number.parseInt(digits, 10) : 0)
  }

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        inputMode="numeric"
        value={value ? formatNumber(value) : ""}
        onChange={handleChange}
        placeholder={placeholder ?? "0"}
        className="pl-7 text-right font-medium tabular-nums"
        disabled={disabled}
      />
    </div>
  )
}
