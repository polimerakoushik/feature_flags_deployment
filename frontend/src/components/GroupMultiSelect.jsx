import { useEffect, useMemo, useRef, useState } from "react";

function GroupMultiSelect({ options, selected, onChange, disabled = false, loading = false, placeholder = "Select one or more groups..." }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (activeIndex >= filteredOptions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredOptions.length]);

  function toggleGroup(groupName) {
    if (disabled) return;
    if (selected.includes(groupName)) {
      onChange(selected.filter((value) => value !== groupName));
      return;
    }
    onChange([...selected, groupName]);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!filteredOptions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((value) => (value + 1) % filteredOptions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((value) => (value - 1 + filteredOptions.length) % filteredOptions.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      setOpen(true);
      toggleGroup(filteredOptions[activeIndex]);
    }
  }

  return (
    <div className="group-multi-select" ref={rootRef}>
      <div className="group-multi-select-shell">
        <input
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="group-toggle-button"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle group list"
        >
          ▾
        </button>
      </div>

      {open && !disabled && (
        <div className="group-dropdown" role="listbox">
          {loading ? (
            <div className="group-skeleton-list">
              <div className="group-skeleton-row" />
              <div className="group-skeleton-row" />
              <div className="group-skeleton-row" />
            </div>
          ) : filteredOptions.length === 0 ? (
            <p className="group-empty-hint">No matching groups.</p>
          ) : (
            filteredOptions.map((groupName, index) => {
              const checked = selected.includes(groupName);
              return (
                <button
                  key={groupName}
                  type="button"
                  className={`group-option ${index === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => toggleGroup(groupName)}
                >
                  <span className="group-option-leading">
                    <span className="group-option-checkbox">{checked ? "☑" : "☐"}</span>
                    <span className="group-option-icon">👥</span>
                  </span>
                  <span className="group-option-label">{groupName}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="group-multi-select-actions">
        <button type="button" onClick={() => onChange([])} disabled={disabled || selected.length === 0}>
          Clear all selections
        </button>
      </div>
    </div>
  );
}

export default GroupMultiSelect;
