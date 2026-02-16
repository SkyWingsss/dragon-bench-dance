import type { PlayerSlot } from "../game/types";

interface SlotPickerProps {
  selected: PlayerSlot;
  onSelect: (slot: PlayerSlot) => void;
  onStart: () => void;
}

const slots: PlayerSlot[] = [1, 2, 3, 4, 5];

export function SlotPicker(props: SlotPickerProps): JSX.Element {
  return (
    <section className="overlay-card slot-picker">
      <h2>选择节位</h2>
      <p>建议先用 1 号完成新手教学，再挑战后排节位。</p>
      <div className="slot-grid">
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            className={`slot-button ${props.selected === slot ? "active" : ""}`}
            onClick={() => props.onSelect(slot)}
          >
            {slot}号
          </button>
        ))}
      </div>
      <button type="button" className="primary-button" onClick={props.onStart}>
        开始狂舞
      </button>
    </section>
  );
}
