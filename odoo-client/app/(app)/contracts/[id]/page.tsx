import type { Metadata } from 'next'
import ContractDetail from '@/features/contracts/contract-detail'

export const metadata: Metadata = { title: 'Contract details' }
export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ContractDetail key={id} contractId={id} />
}
