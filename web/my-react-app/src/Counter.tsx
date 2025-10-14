// Counter.jsx
import { useState } from "react";

export default function Counter({ step = 1 }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + step)}>+{step}</button>
    </div>
  );
}
