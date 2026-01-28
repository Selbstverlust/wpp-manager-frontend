export type InstanceStatus = 'connected' | 'disconnected' | 'pending';

export type Instance = {
  id: string;
  name: string;
  status: InstanceStatus;
  createdAt: string;
};

// This is a mock database. In a real application, you'd fetch this from a server.
const instances: Instance[] = [
  {
    id: 'wbm-8a2b4cde',
    name: 'Customer Support Bot',
    status: 'connected',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'wbm-1f9e6a7b',
    name: 'Sales Inquiries',
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'wbm-5d3c7e8a',
    name: 'Legacy Bot (Offline)',
    status: 'disconnected',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
];

// Simulate API delay
export async function getInstances(): Promise<Instance[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(instances);
    }, 300);
  });
}
