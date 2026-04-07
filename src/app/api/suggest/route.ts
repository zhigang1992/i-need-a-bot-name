import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/suggest";

const VALID_PLATFORMS = ["domain", "npm", "github", "telegram"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, platforms, count } = body;

    // Validate description
    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "invalid_input", message: "Description is required." },
        { status: 400 }
      );
    }
    if (description.length > 500) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Description must be 500 characters or less.",
        },
        { status: 400 }
      );
    }

    // Validate platforms
    const resolvedPlatforms = platforms ?? VALID_PLATFORMS;
    if (!Array.isArray(resolvedPlatforms)) {
      return NextResponse.json(
        { error: "invalid_input", message: "Platforms must be an array." },
        { status: 400 }
      );
    }
    for (const p of resolvedPlatforms) {
      if (!VALID_PLATFORMS.includes(p)) {
        return NextResponse.json(
          {
            error: "unsupported_platform",
            message: `Platform "${p}" is not supported. Valid: ${VALID_PLATFORMS.join(", ")}`,
          },
          { status: 501 }
        );
      }
    }

    // Validate count
    const resolvedCount = count ?? 5;
    if (
      typeof resolvedCount !== "number" ||
      resolvedCount < 1 ||
      resolvedCount > 20
    ) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Count must be between 1 and 20.",
        },
        { status: 400 }
      );
    }

    const result = await suggest(
      description.trim(),
      resolvedPlatforms,
      resolvedCount
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";

    if (message.startsWith("no_names_generated")) {
      return NextResponse.json(
        { error: "no_names_generated", message },
        { status: 200 }
      );
    }
    if (message.startsWith("generation_failed")) {
      return NextResponse.json(
        { error: "generation_failed", message },
        { status: 502 }
      );
    }

    console.error("Suggest error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Something went wrong." },
      { status: 500 }
    );
  }
}
