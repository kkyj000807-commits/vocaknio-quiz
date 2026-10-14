import { describe, expect, it, vi } from "vitest";
import { createPronunciationPlayer } from "@/lib/pronunciation-playback";
import { DEFAULT_PRONUNCIATION } from "@/lib/pronunciation-preference";

function fixture() {
  let voices = [{ lang: "en-US", name: "Microsoft Aria Natural", voiceURI: "aria" }] as SpeechSynthesisVoice[];
  class Utterance { constructor(public text: string) {} }
  const synthesis = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => voices };
  let rejectPlay!: (reason: Error) => void;
  const audios: Audio[] = [];
  class Audio {
    onplay: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onended: (() => void) | null = null;
    pause = vi.fn();
    play = vi.fn(() => new Promise<void>((_, reject) => { rejectPlay = reject; }));
    constructor(public url: string) { audios.push(this); }
  }
  const env = { speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance, Audio } as unknown as Parameters<typeof createPronunciationPlayer>[0];
  const player = createPronunciationPlayer(env);
  const start = (options: Partial<Parameters<typeof player.play>[0]> = {}) => {
    const onStatus = vi.fn();
    const stop = player.play({ text: "A clear example.", preference: DEFAULT_PRONUNCIATION, onStatus, ...options });
    return { stop, onStatus };
  };
  return { env, player, synthesis, start, audios, reject: () => rejectPlay(new Error("audio failed")), setVoices: (next: SpeechSynthesisVoice[]) => { voices = next; } };
}

describe("shared pronunciation playback", () => {
  it("uses US female preference at natural pitch and the approved rate", () => {
    const f = fixture(); f.start();
    expect(f.synthesis.speak.mock.calls[0][0]).toMatchObject({ text: "A clear example.", lang: "en-US", rate: 0.95, pitch: 1, voice: { voiceURI: "aria" } });
  });
  it("retains the click gesture with an empty voice list and uses delayed voices on the next click", () => {
    const f = fixture(); f.setVoices([]); f.start();
    expect(f.synthesis.speak.mock.calls[0][0].voice).toBeNull();
    f.setVoices([{ lang: "en-US", name: "Samantha", voiceURI: "new" }] as SpeechSynthesisVoice[]);
    f.start(); expect(f.synthesis.speak.mock.calls[1][0].voice.voiceURI).toBe("new");
  });
  it("changing owner stops the old voice and ignores late callbacks and old cleanup", () => {
    const f = fixture(); const first = f.start();
    const lateStart = f.synthesis.speak.mock.calls[0][0].onstart;
    const second = f.start({ text: "Another example." });
    expect(f.synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(first.onStatus.mock.lastCall?.[0].speaking).toBe(false);
    const calls = first.onStatus.mock.calls.length;
    lateStart(); first.stop();
    expect(first.onStatus).toHaveBeenCalledTimes(calls);
    expect(f.synthesis.cancel).toHaveBeenCalledTimes(1);
    second.stop(); expect(f.synthesis.cancel).toHaveBeenCalledTimes(2);
  });
  it("a recording failure falls back once; an old rejected play never interrupts a newer request", async () => {
    const f = fixture();
    const first = f.start({ recordingUrl: "https://example.test/licensed.ogg", preference: { ...DEFAULT_PRONUNCIATION, preferRecording: true } });
    f.start(); f.reject(); await Promise.resolve();
    expect(f.synthesis.speak).toHaveBeenCalledTimes(1);
    expect(f.audios[0].pause).toHaveBeenCalled();
    first.stop();
    f.start({ recordingUrl: "https://example.test/licensed.ogg", preference: { ...DEFAULT_PRONUNCIATION, preferRecording: true } });
    const error = f.audios[1].onerror!;
    error(); f.reject(); await Promise.resolve();
    expect(f.synthesis.speak).toHaveBeenCalledTimes(2);
  });
  it("defaults to a licensed recording when one is available", () => {
    const f = fixture(); f.start({ recordingUrl: "https://example.test/licensed.ogg" });
    expect(f.audios).toHaveLength(1);
    expect(f.synthesis.speak).not.toHaveBeenCalled();
  });
  it("explicit synthesized speech preference does not fetch a licensed recording", () => {
    const f = fixture(); f.start({ recordingUrl: "https://example.test/licensed.ogg", preference: { ...DEFAULT_PRONUNCIATION, preferRecording: false } });
    expect(f.audios).toHaveLength(0);
    expect(f.synthesis.speak).toHaveBeenCalledOnce();
  });
  it("unmount cleanup cancels synthesis and prevents callbacks", () => {
    const f = fixture(); const request = f.start();
    const utterance = f.synthesis.speak.mock.calls[0][0];
    request.stop(); expect(utterance.onstart).toBeNull(); expect(utterance.onend).toBeNull();
    expect(f.synthesis.cancel).toHaveBeenCalledOnce();
  });
  it("missing APIs and synthesis failures report failure, not success", () => {
    const f = fixture(); f.env.SpeechSynthesisUtterance = undefined as unknown as typeof SpeechSynthesisUtterance;
    expect(f.start().onStatus.mock.lastCall?.[0]).toMatchObject({ speaking: false, failed: true });
    const g = fixture(); g.synthesis.speak.mockImplementation(() => { throw new Error("unavailable"); });
    expect(g.start().onStatus.mock.lastCall?.[0]).toMatchObject({ speaking: false, failed: true });
  });
});
