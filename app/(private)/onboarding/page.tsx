"use client";

import { useState } from "react";
import { OnboardingForm } from "@/modules/auth/components/OnboardingForm";
import { WorkshopSetupSuccessModal } from "@/modules/auth/components/WorkshopSetupSuccessModal";

export default function OnboardingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Configura tu taller
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          Completa los datos para empezar a usar Confectu.
        </p>
        <div className="mt-6">
          <OnboardingForm onSuccess={() => setShowModal(true)} />
        </div>
      </div>
      {showModal ? <WorkshopSetupSuccessModal /> : null}
    </div>
  );
}
