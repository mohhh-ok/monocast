type Props = {
  message: string;
};

export function ErrorToast({ message }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "10px 16px",
        background: "#3a1620",
        border: "1px solid #ff5a6e",
        borderRadius: 8,
        color: "#ffb8c0",
        fontSize: 13,
        maxWidth: "min(600px, 90vw)",
      }}
    >
      {message}
    </div>
  );
}
