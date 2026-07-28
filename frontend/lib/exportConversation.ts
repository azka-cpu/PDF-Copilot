interface ExportableMessage {
  role: "user" | "assistant";
  content: string;
}

export function exportConversation(filename: string, messages: ExportableMessage[]) {
  const lines = messages.map(
    (m) => `${m.role === "user" ? "You" : "PDF Copilot"}: ${m.content}`
  );
  const text = `Conversation about ${filename}\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.pdf$/i, "")}-conversation.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
