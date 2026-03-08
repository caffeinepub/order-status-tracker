import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface OrderStatus {
    status1: string;
    status2: string;
    status3: string;
    status4: string;
    status5: string;
    status6: string;
    status7: string;
    status8: string;
    status9: string;
    status10: string;
    status11: string;
    status12: string;
    status13: string;
    status14: string;
    status15: string;
    status16: string;
    status17: string;
    status18: string;
    status19: string;
    status20: string;
    status21: string;
    orderId: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    bulkUpsertOrders(ordersArray: Array<OrderStatus>): Promise<void>;
    deleteOrder(orderId: string): Promise<void>;
    getAllOrders(): Promise<Array<OrderStatus>>;
    getAppConfig(key: string): Promise<string | null>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getOrder(_orderId: string): Promise<OrderStatus | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setAppConfig(key: string, value: string): Promise<void>;
    upsertOrder(order: OrderStatus): Promise<void>;
}
