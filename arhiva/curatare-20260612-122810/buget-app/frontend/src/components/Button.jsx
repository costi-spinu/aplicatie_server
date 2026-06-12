export default function Button({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        border: "1px solid #cfd8d3",
        borderRadius: 4,
        padding: "10px 14px",
        background: "#ffffff",
        color: "#10201a",
        fontWeight: 700,
        cursor: "pointer",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}
