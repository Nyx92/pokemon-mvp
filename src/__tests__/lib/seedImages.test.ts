import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("fs", () => ({ default: mockFs, ...mockFs }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// uploadImage's actual compression is covered separately by imageProcessing's
// own tests — stub it here so these tests can assert on upload/cache
// plumbing with plain fake byte buffers instead of real image data.
vi.mock("@/lib/imageProcessing", () => ({
  compressCardImage: vi.fn(async (input: Buffer) => ({
    buffer: Buffer.concat([Buffer.from("compressed:"), input]),
    contentType: "image/webp",
  })),
  toWebpStoragePath: (storagePath: string) => storagePath.replace(/\.[^./]+$/, ".webp"),
}));

import {
  downloadImageWithCache,
  uploadImage,
  uploadImageFromUrl,
  riftboundImageCachePath,
} from "@/lib/seedImages";

function buildSupabaseMock() {
  const upload = vi.fn().mockResolvedValue({ data: { path: "mock/riftbound/unl-176-219.webp" }, error: null });
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: "https://tfjkxfalbqegwjsfbyuo.supabase.co/storage/v1/object/public/card-images/mock/riftbound/unl-176-219.webp" },
  });
  const from = vi.fn(() => ({ upload, getPublicUrl, remove }));
  return { storage: { from } } as any;
}

function fakeImageResponse(overrides: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Map([["content-type", "image/png"]]) as any,
    arrayBuffer: async () => new ArrayBuffer(8),
    ...overrides,
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFs.existsSync.mockReset();
  mockFs.readFileSync.mockReset();
  mockFs.writeFileSync.mockReset();
  mockFs.mkdirSync.mockReset();
});

describe("downloadImageWithCache", () => {
  const CACHE_PATH = "/tmp/cache/unl-176-219.png";

  it("reads from the local cache and never calls fetch when the file already exists", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(Buffer.from("cached-bytes"));

    const result = await downloadImageWithCache("https://cms.example.com/vi.png", CACHE_PATH);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFs.readFileSync).toHaveBeenCalledWith(CACHE_PATH);
    expect(result.buffer.toString()).toBe("cached-bytes");
    expect(result.contentType).toBe("image/png");
  });

  it("downloads and writes the bytes to the cache path when nothing is cached yet", async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFetch.mockResolvedValue(fakeImageResponse());

    const result = await downloadImageWithCache("https://cms.example.com/vi.png", CACHE_PATH);

    expect(mockFetch).toHaveBeenCalledWith("https://cms.example.com/vi.png");
    expect(mockFs.mkdirSync).toHaveBeenCalledWith("/tmp/cache", { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(CACHE_PATH, expect.any(Buffer));
    expect(result.contentType).toBe("image/png");
  });

  it("throws a clear error and writes nothing when the download fails", async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFetch.mockResolvedValue(fakeImageResponse({ ok: false, status: 404 }));

    await expect(
      downloadImageWithCache("https://cms.example.com/missing.png", CACHE_PATH)
    ).rejects.toThrow(/404/);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("infers content type from the cache file's extension when reading from cache", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(Buffer.from("x"));

    const result = await downloadImageWithCache("https://cms.example.com/vi.jpg", "/tmp/cache/vi.jpg");
    expect(result.contentType).toBe("image/jpeg");
  });
});

describe("uploadImage", () => {
  it("uploads the given bytes to the card-images bucket and returns the public URL", async () => {
    const supabase = buildSupabaseMock();

    const url = await uploadImage(
      supabase,
      { buffer: Buffer.from("bytes"), contentType: "image/png" },
      "mock/riftbound/unl-176-219.png"
    );

    expect(supabase.storage.from).toHaveBeenCalledWith("card-images");
    const { upload, getPublicUrl } = supabase.storage.from.mock.results[0].value;
    expect(upload).toHaveBeenCalledWith(
      "mock/riftbound/unl-176-219.webp",
      expect.any(Buffer),
      { contentType: "image/webp", upsert: true }
    );
    expect(getPublicUrl).toHaveBeenCalledWith("mock/riftbound/unl-176-219.webp");
    expect(url).toBe("https://tfjkxfalbqegwjsfbyuo.supabase.co/storage/v1/object/public/card-images/mock/riftbound/unl-176-219.webp");
  });

  it("cleans up the original-extension object once the .webp copy is uploaded", async () => {
    const supabase = buildSupabaseMock();

    await uploadImage(
      supabase,
      { buffer: Buffer.from("bytes"), contentType: "image/png" },
      "mock/riftbound/unl-176-219.png"
    );

    const { remove } = supabase.storage.from.mock.results[0].value;
    expect(remove).toHaveBeenCalledWith(["mock/riftbound/unl-176-219.png"]);
  });

  it("throws a clear error when the Supabase upload fails", async () => {
    const supabase = buildSupabaseMock();
    supabase.storage.from().upload.mockResolvedValue({ data: null, error: { message: "bucket not found" } });

    await expect(
      uploadImage(supabase, { buffer: Buffer.from("x"), contentType: "image/png" }, "mock/riftbound/x.png")
    ).rejects.toThrow(/bucket not found/);
  });
});

describe("uploadImageFromUrl", () => {
  it("uses the local cache instead of the network when already cached", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(Buffer.from("cached-bytes"));
    const supabase = buildSupabaseMock();

    const url = await uploadImageFromUrl(
      supabase,
      "https://cms.example.com/vi.png",
      "mock/riftbound/unl-176-219.png",
      "/tmp/cache/unl-176-219.png"
    );

    expect(mockFetch).not.toHaveBeenCalled();
    const { upload } = supabase.storage.from.mock.results[0].value;
    expect(upload).toHaveBeenCalledWith(
      "mock/riftbound/unl-176-219.webp",
      expect.any(Buffer),
      { contentType: "image/webp", upsert: true }
    );
    expect(url).toBe("https://tfjkxfalbqegwjsfbyuo.supabase.co/storage/v1/object/public/card-images/mock/riftbound/unl-176-219.webp");
  });

  it("downloads, caches, and uploads when nothing is cached yet", async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFetch.mockResolvedValue(fakeImageResponse());
    const supabase = buildSupabaseMock();

    await uploadImageFromUrl(
      supabase,
      "https://cms.example.com/vi.png",
      "mock/riftbound/unl-176-219.png",
      "/tmp/cache/unl-176-219.png"
    );

    expect(mockFetch).toHaveBeenCalledWith("https://cms.example.com/vi.png");
    expect(mockFs.writeFileSync).toHaveBeenCalledWith("/tmp/cache/unl-176-219.png", expect.any(Buffer));
  });
});

describe("riftboundImageCachePath", () => {
  it("returns the same path for the same riftboundId every time (so both seed scripts agree on it)", () => {
    const a = riftboundImageCachePath("unl-176-219");
    const b = riftboundImageCachePath("unl-176-219");
    expect(a).toBe(b);
    expect(a.endsWith("unl-176-219.png")).toBe(true);
    expect(a).toContain("prisma");
    expect(a).toContain(".cache");
  });

  it("returns a different path for a different riftboundId", () => {
    expect(riftboundImageCachePath("unl-176-219")).not.toBe(riftboundImageCachePath("pr-246a-298"));
  });
});
