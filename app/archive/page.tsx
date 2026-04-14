import { redirect } from "next/navigation";

/** Ancienne URL Archive : tout est regroupé sous Traité. */
export default function ArchivePageRedirect() {
  redirect("/transfere");
}
