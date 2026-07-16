import { cache } from "react";
import { auth } from "@/auth";

/** Dedupes auth() within a single RSC request (layout + page). */
export const getSession = cache(() => auth());
