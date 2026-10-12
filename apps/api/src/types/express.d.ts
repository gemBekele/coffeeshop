import type { StaffRole } from "@coffeeshop/shared";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: {
        id: string;
        role: StaffRole;
        shopId: string;
        fullName: string;
      };
      device?: {
        id: string;
        shopId: string;
        role: StaffRole;
        label: string;
      };
    }
  }
}

export {};
