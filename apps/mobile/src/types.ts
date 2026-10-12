export type AppRole = "OWNER" | "EMPLOYEE";

export interface Session {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    fullName: string;
    role: "OWNER" | "MANAGER" | "CASHIER" | "BARISTA";
    shopId: string;
  };
}
