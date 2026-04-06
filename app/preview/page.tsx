import dynamic from 'next/dynamic'

const PreviewClient = dynamic(() => import('@/components/preview/PreviewClient'), { ssr: false })

export default function PreviewPage() {
  return <PreviewClient />
}
