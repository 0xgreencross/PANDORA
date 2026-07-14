// PANDORA GARDENS — signed-action gate (Supabase Edge Function: "garden-write")
// Dashboard -> Edge Functions -> New function -> name: garden-write -> paste -> Deploy.
// Then: Settings -> Edge Functions -> ensure "Verify JWT" is OFF for this function.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyMessage } from "npm:ethers@6";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, address, card, thumb, ts, signature } = await req.json();
    if (!["plant", "uproot"].includes(action)) throw new Error("bad action");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("bad address");
    if (typeof card !== "string" || !card.startsWith("PNDR-") || card.length > 48) throw new Error("bad card");
    if (Math.abs(Date.now() - ts) > 10 * 60 * 1000) throw new Error("stale signature");
    // the exact message the app asks the wallet to sign — replay-bounded by ts
    const msg = `PANDORA GARDEN\n${action.toUpperCase()} ${card}\nby ${address.toLowerCase()}\nat ${ts}`;
    const recovered = verifyMessage(msg, signature).toLowerCase();
    if (recovered !== address.toLowerCase()) throw new Error("signature mismatch");

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (action === "plant") {
      const { error } = await db.from("gardens").insert({
        address: address.toLowerCase(), card,
        thumb: (typeof thumb === "string" && thumb.length < 9000) ? thumb : "",
        ts,
      });
      if (error && !String(error.message).includes("duplicate")) throw error;
      return new Response(JSON.stringify({ ok: true, dup: !!error }), { headers: cors });
    } else {
      const { error } = await db.from("gardens").delete()
        .eq("address", address.toLowerCase()).eq("card", card);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, err: String(e.message || e) }), { status: 400, headers: cors });
  }
});
