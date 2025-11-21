import { Spinner } from "@/components/ui/spinner"

export default function InstructionsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-12 w-12 text-primary" />
    </div>
  )
}
