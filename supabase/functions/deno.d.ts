// Type definitions for Supabase Edge Functions (Deno runtime)
// This file allows TypeScript and IDEs (without Deno extension) to typecheck
// Supabase edge functions that use Deno globals and URL imports.

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };

  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: {
      port?: number;
      hostname?: string;
      onListen?: (params: { port: number; hostname: string }) => void;
      onError?: (error: unknown) => Response | Promise<Response>;
    }
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: (
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ) => any;
}

declare module "https://*" {
  const content: any;
  export default content;
  export const createClient: any;
}
