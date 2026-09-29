import { AdminContentEditor } from '@/components/admin/admin-content-editor';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AdminContentEditor kind="news" id={id} />; }
