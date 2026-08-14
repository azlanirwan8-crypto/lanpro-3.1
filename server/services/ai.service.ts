export async function generateContentWithFallback(ai: any, params: any) {
  const originalModel = params.model || "gemini-3.5-flash";

  const fallbackModels: string[] = [originalModel];
  if (!fallbackModels.includes("gemini-flash-latest")) {
    fallbackModels.push("gemini-flash-latest");
  }
  if (!fallbackModels.includes("gemini-3.1-flash-lite")) {
    fallbackModels.push("gemini-3.1-flash-lite");
  }
  if (!fallbackModels.includes("gemini-3.5-flash")) {
    fallbackModels.push("gemini-3.5-flash");
  }
  if (!fallbackModels.includes("gemini-2.5-flash")) {
    fallbackModels.push("gemini-2.5-flash");
  }

  let lastError: any = null;

  for (const modelToTry of fallbackModels) {
    const finalParams = { ...params, model: modelToTry };
    const maxRetries = 3;
    let delayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[GEMINI] Calling model: ${modelToTry} (Attempt ${attempt}/${maxRetries})`);
        return await ai.models.generateContent(finalParams);
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || String(error);

        const isQuotaExceeded =
          errorMsg.includes("429") ||
          errorMsg.includes("RESOURCE_EXHAUSTED") ||
          errorMsg.includes("quota") ||
          errorMsg.includes("limit") ||
          errorMsg.includes("exceeded");

        const isHighDemand =
          errorMsg.includes("503") ||
          errorMsg.includes("demand") ||
          errorMsg.includes("UNAVAILABLE");

        if (isQuotaExceeded || isHighDemand) {
          console.warn(
            `[GEMINI] Model ${modelToTry} hit quota, high demand, or unavailability. Switching to next fallback model immediately...`
          );
          break;
        }

        const isTemporary =
          errorMsg.includes("500") ||
          errorMsg.includes("502") ||
          errorMsg.includes("504") ||
          errorMsg.includes("BAD_GATEWAY") ||
          errorMsg.includes("TIMEOUT") ||
          errorMsg.includes("fetch failed") ||
          errorMsg.includes("TypeError") ||
          errorMsg.includes("network") ||
          errorMsg.includes("ENOTFOUND") ||
          errorMsg.includes("EAI_AGAIN") ||
          errorMsg.includes("ECONNRESET") ||
          errorMsg.includes("ECONNREFUSED");

        if (isTemporary && attempt < maxRetries) {
          console.warn(
            `[GEMINI] Model ${modelToTry} failed with temporary error/network issue (Attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms. Error:`,
            errorMsg
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }

        console.error(
          `[GEMINI] Model ${modelToTry} failed with error: ${errorMsg}. Trying next fallback model...`
        );
        break;
      }
    }

    if (lastError && (lastError.message || String(lastError)).includes("fetch failed")) {
      console.warn(
        `[GEMINI] Short pause (1500ms) to let network stabilize before trying the next fallback model...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.error(`[GEMINI] All fallback models failed. Final error:`, lastError?.message || lastError);
  throw lastError;
}
