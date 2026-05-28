import type Anthropic from "@anthropic-ai/sdk";

export function fakeAnthropic(jsonReply: object | string): Anthropic {
  const body = typeof jsonReply === "string" ? jsonReply : JSON.stringify(jsonReply);
  const create = (async () => ({
    id: "msg_x",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    content: [{ type: "text", text: body }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  })) as unknown as Anthropic["messages"]["create"];
  return { messages: { create } } as unknown as Anthropic;
}
