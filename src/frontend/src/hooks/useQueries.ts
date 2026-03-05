import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { MutableRefObject } from "react";
import type { OrderStatus } from "../backend.d";
import { useActor } from "./useActor";

const ACTOR_WAIT_TIMEOUT = 10_000; // 10 seconds

async function waitForActorRef<T>(
  ref: MutableRefObject<T | null>,
  timeoutMs = ACTOR_WAIT_TIMEOUT,
): Promise<T> {
  if (ref.current) return ref.current;

  return new Promise<T>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = setInterval(() => {
      if (ref.current) {
        clearInterval(poll);
        resolve(ref.current);
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error("Backend not ready. Please try again."));
      }
    }, 200);
  });
}

export function useGetOrder(orderId: string | null) {
  const { actor, isFetching } = useActor();
  return useQuery<OrderStatus | null>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!actor || !orderId) return null;
      return actor.getOrder(orderId);
    },
    enabled: !!actor && !isFetching && !!orderId,
    retry: false,
  });
}

export function useGetAllOrders() {
  const { actor, isFetching } = useActor();
  return useQuery<OrderStatus[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllOrders();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIsAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useBulkUpsertOrders() {
  const { actor } = useActor();
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orders: OrderStatus[]) => {
      const resolvedActor = await waitForActorRef(actorRef);
      return resolvedActor.bulkUpsertOrders(orders);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useDeleteOrder() {
  const { actor } = useActor();
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const resolvedActor = await waitForActorRef(actorRef);
      return resolvedActor.deleteOrder(orderId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useUpsertOrder() {
  const { actor } = useActor();
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: OrderStatus) => {
      const resolvedActor = await waitForActorRef(actorRef);
      return resolvedActor.upsertOrder(order);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
