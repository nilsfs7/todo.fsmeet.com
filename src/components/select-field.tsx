"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { fieldClass } from "./ui";

export type MenuOption = { value: string; label: string };

const menuClass =
  "absolute z-40 max-h-64 w-full overflow-auto rounded-xl border border-line bg-card p-1 text-sm text-ink shadow-[0_16px_40px_rgba(28,25,21,0.16)]";

export function SelectField({
  name,
  value,
  defaultValue = "",
  onValueChange,
  options,
  disabled,
  ariaLabel,
  className,
  submitOnChange,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: MenuOption[];
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  submitOnChange?: boolean;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const selected = value ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const typed = useRef("");
  const typedAt = useRef(0);
  const selectedLabel = options.find((option) => option.value === selected)?.label ?? selected;

  useDismiss(open, rootRef, () => setOpen(false));
  useScrollActive(open, activeIndex, menuRef);

  function commit(next: string) {
    if (value === undefined) flushSync(() => setUncontrolled(next));
    onValueChange?.(next);
    setOpen(false);
    if (submitOnChange) rootRef.current?.closest("form")?.requestSubmit();
    buttonRef.current?.focus();
  }

  function openAt(index: number) {
    setActiveIndex(index < 0 ? 0 : index);
    setOpen(true);
  }

  function move(delta: number) {
    if (options.length === 0) return;
    setActiveIndex((current) => (current + delta + options.length) % options.length);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openAt(Math.max(0, options.findIndex((option) => option.value === selected)));
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openAt(Math.max(0, options.findIndex((option) => option.value === selected)));
      else if (options[activeIndex]) commit(options[activeIndex].value);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key.length === 1 && options.length > 0) {
      const now = Date.now();
      typed.current = now - typedAt.current < 600 ? typed.current + event.key.toLowerCase() : event.key.toLowerCase();
      typedAt.current = now;
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(typed.current));
      if (index >= 0) {
        setActiveIndex(index);
        if (!open) commit(options[index]!.value);
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full ${open ? "z-30" : ""} ${className ?? ""}`}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <button
        ref={buttonRef}
        type="button"
        className={`${fieldClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else openAt(Math.max(0, options.findIndex((option) => option.value === selected)));
        }}
        onKeyDown={onKeyDown}
      >
        <span className="truncate">{selectedLabel}</span>
        <Chevron />
      </button>
      {open ? (
        <ul
          ref={(node) => {
            menuRef.current = node;
            placeMenu(rootRef.current, node);
          }}
          id={listId}
          role="listbox"
          className={menuClass}
        >
          {options.map((option, index) => (
            <MenuItem
              key={option.value}
              index={index}
              label={option.label}
              selected={option.value === selected}
              active={index === activeIndex}
              onHover={() => setActiveIndex(index)}
              onPick={() => commit(option.value)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SuggestField({
  name,
  defaultValue = "",
  suggestions,
  disabled,
  placeholder,
  maxLength,
}: {
  name: string;
  defaultValue?: string;
  suggestions: string[];
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const needle = text.trim().toLowerCase();
  const matches = (needle ? suggestions.filter((item) => item.toLowerCase().includes(needle)) : suggestions).map(
    (item) => ({ value: item, label: item }),
  );

  useDismiss(open, rootRef, () => setOpen(false));
  useScrollActive(open, activeIndex, menuRef);

  function pick(next: string) {
    setText(next);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    } else if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      pick(matches[activeIndex].value);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full ${open ? "z-30" : ""}`}>
      <input
        name={name}
        value={text}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
        onChange={(event) => {
          setText(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onPointerDown={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 ? (
        <ul
          ref={(node) => {
            menuRef.current = node;
            placeMenu(rootRef.current, node);
          }}
          id={listId}
          role="listbox"
          className={menuClass}
        >
          {matches.map((option, index) => (
            <MenuItem
              key={option.value}
              index={index}
              label={option.label}
              selected={option.value === text}
              active={index === activeIndex}
              onHover={() => setActiveIndex(index)}
              onPick={() => pick(option.value)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MenuItem({
  index,
  label,
  selected,
  active,
  onHover,
  onPick,
}: {
  index: number;
  label: string;
  selected: boolean;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      data-index={index}
      onMouseEnter={onHover}
      onMouseDown={(event) => {
        event.preventDefault();
        onPick();
      }}
      className={`cursor-pointer rounded-lg px-3 py-2 ${
        selected ? "bg-navy font-medium text-white" : active ? "bg-paper text-ink" : "text-ink"
      }`}
    >
      {label}
    </li>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 text-muted">
      <path d="M3 5.2 7 9l4-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function useDismiss(open: boolean, rootRef: React.RefObject<HTMLDivElement | null>, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeRef.current();
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, rootRef]);
}

function placeMenu(root: HTMLDivElement | null, menu: HTMLUListElement | null) {
  if (!root || !menu) return;
  const rootRect = root.getBoundingClientRect();
  const boundary = root.closest("dialog")?.getBoundingClientRect();
  const spaceBelow = (boundary?.bottom ?? window.innerHeight) - rootRect.bottom;
  const spaceAbove = rootRect.top - (boundary?.top ?? 0);
  const up = spaceBelow < menu.offsetHeight + 8 && spaceAbove > spaceBelow;
  menu.style.top = up ? "auto" : "calc(100% + 0.25rem)";
  menu.style.bottom = up ? "calc(100% + 0.25rem)" : "auto";
}

function useScrollActive(open: boolean, activeIndex: number, menuRef: React.RefObject<HTMLUListElement | null>) {
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, menuRef]);
}
