import "server-only";
import { config } from "./config";
import { identity } from "./auth";
export async function appViewer(){const c=config();return {configured:c.database&&c.auth,who:c.database&&c.auth?await identity():null};}
