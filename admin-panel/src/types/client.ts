import type { ClientPlan, ClientStatus } from "@/lib/client-options";

export type ClientRecord = {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  plan: ClientPlan;
  status: ClientStatus;
  password: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientCreateInput = {
  name: string;
  email: string;
  password: string;
  notes?: string;
  company?: string;
  phone?: string;
  plan?: string;
  status?: string;
};

export type ClientUpdateInput = {
  id: string;
  name?: string;
  email?: string;
  password?: string;
  notes?: string;
  company?: string;
  phone?: string;
  plan?: string;
  status?: string;
};
