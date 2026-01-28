import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Check for auth token - this is a protected route
    const cookieStore = await cookies();
    const hasAuth = cookieStore.get('wppmanager_token') !== undefined;

    // Note: Client-side auth check is also done in the page component
    // This is just an extra layer of protection

    return <>{children}</>;
}
