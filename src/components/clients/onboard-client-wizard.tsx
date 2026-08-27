'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FolderKanban,
  Loader2,
  Plus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOnboardClient } from '@/hooks/use-clients';
import { OnboardClientInput, OnboardClientSchema } from '@/lib/client/client.schema';

export function OnboardClientWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [canSubmit, setCanSubmit] = useState(false);
  const { mutateAsync: onboardClient, isPending } = useOnboardClient();

  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => setCanSubmit(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanSubmit(false);
    }
  }, [step]);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(OnboardClientSchema),
    defaultValues: {
      name: '',
      code: '',
      email: '',
      phone: '',
      website: '',
      contactName: '',
      address: '',
      industry: '',
      notes: '',
      project: {
        name: '',
        code: '',
        description: '',
      },
    },
    mode: 'onTouched',
  });

  const formValues = watch();

  const handleNext = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    let isValid = false;
    if (step === 1) {
      isValid = await trigger([
        'name',
        'code',
        'email',
        'phone',
        'website',
        'contactName',
        'address',
        'industry',
        'notes',
      ]);
    } else if (step === 2) {
      isValid = await trigger(['project.name', 'project.code', 'project.description']);
    }

    if (isValid) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const onSubmit = async (data: OnboardClientInput) => {
    if (step < 3) {
      // If submitted via Enter key before review step, just move to next step
      handleNext();
      return;
    }

    try {
      const result = await onboardClient(data);

      if (data.email) {
        toast.success(`Client onboarded. An invitation email has been sent to ${data.email}.`);
      } else {
        toast.success('Client and project created successfully');
      }

      setOpen(false);
      reset();
      setStep(1);

      if (result && result.client && result.client.id) {
        router.push('/clients');
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to onboard client');
    }
  };

  const resetDialog = () => {
    setStep(1);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (isPending) return;
        setOpen(val);
        if (!val) resetDialog();
      }}
    >
      <DialogTrigger className="flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700">
        <Plus className="mr-2 h-4 w-4" /> Onboard Client
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Onboard New Client</DialogTitle>
          <DialogDescription className="text-slate-500">
            Create a client organization and their initial project in one go.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper UI */}
        <div className="mt-4 flex items-center justify-between px-2">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              <Building2 className="h-4 w-4" />
            </div>
            <span
              className={`text-[10px] font-semibold uppercase ${step >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              Client
            </span>
          </div>
          <div
            className={`mx-2 h-[2px] flex-1 transition-colors ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-100'}`}
          />
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              <FolderKanban className="h-4 w-4" />
            </div>
            <span
              className={`text-[10px] font-semibold uppercase ${step >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              Project
            </span>
          </div>
          <div
            className={`mx-2 h-[2px] flex-1 transition-colors ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-100'}`}
          />
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span
              className={`text-[10px] font-semibold uppercase ${step >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              Review
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          {/* STEP 1: CLIENT INFO */}
          <div className={step === 1 ? 'block' : 'hidden'}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                  Company Name *
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  className={`h-10 bg-slate-50 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
                  placeholder="Acme Corp"
                  disabled={isPending}
                />
                {errors.name && (
                  <span className="text-[11px] text-red-500">{errors.name.message}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-xs font-semibold text-slate-700">
                    Company Code
                  </Label>
                  <Input
                    id="code"
                    {...register('code')}
                    className="h-10 border-slate-200 bg-slate-50"
                    placeholder="ACM"
                    disabled={isPending}
                  />
                  {errors.code && (
                    <span className="text-[11px] text-red-500">{errors.code.message}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactName" className="text-xs font-semibold text-slate-700">
                    Primary Contact *
                  </Label>
                  <Input
                    id="contactName"
                    {...register('contactName')}
                    className={`h-10 bg-slate-50 ${errors.contactName ? 'border-red-400' : 'border-slate-200'}`}
                    placeholder="Jane Doe"
                    disabled={isPending}
                  />
                  {errors.contactName && (
                    <span className="text-[11px] text-red-500">{errors.contactName.message}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Email Address (Invites user) *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    className={`h-10 bg-slate-50 ${errors.email ? 'border-red-400' : 'border-slate-200'}`}
                    placeholder="jane@acme.com"
                    disabled={isPending}
                  />
                  {errors.email && (
                    <span className="text-[11px] text-red-500">{errors.email.message}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    className={`h-10 bg-slate-50 ${errors.phone ? 'border-red-400' : 'border-slate-200'}`}
                    placeholder="+1 (555) 000-0000"
                    disabled={isPending}
                  />
                  {errors.phone && (
                    <span className="text-[11px] text-red-500">
                      {errors.phone.message as string}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="industry" className="text-xs font-semibold text-slate-700">
                    Industry
                  </Label>
                  <Input
                    id="industry"
                    {...register('industry')}
                    className="h-10 border-slate-200 bg-slate-50"
                    placeholder="e.g. Technology, Healthcare"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-xs font-semibold text-slate-700">
                    Website
                  </Label>
                  <Input
                    id="website"
                    {...register('website')}
                    className="h-10 border-slate-200 bg-slate-50"
                    placeholder="https://acme.com"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-700">
                  Address
                </Label>
                <Textarea
                  id="address"
                  {...register('address')}
                  className="max-h-24 overflow-y-auto border-slate-200 bg-slate-50"
                  placeholder="123 Business St, Suite 100..."
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* STEP 2: PROJECT INFO */}
          <div className={step === 2 ? 'block' : 'hidden'}>
            <div className="space-y-4">
              <div className="mb-4 rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
                A client must have at least one initial project.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project.name" className="text-xs font-semibold text-slate-700">
                  Project Name *
                </Label>
                <Input
                  id="project.name"
                  {...register('project.name')}
                  className={`h-10 bg-slate-50 ${errors.project?.name ? 'border-red-400' : 'border-slate-200'}`}
                  placeholder="Website Redesign"
                  disabled={isPending}
                />
                {errors.project?.name && (
                  <span className="text-[11px] text-red-500">{errors.project.name.message}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project.code" className="text-xs font-semibold text-slate-700">
                  Project Code
                </Label>
                <Input
                  id="project.code"
                  {...register('project.code')}
                  className="h-10 border-slate-200 bg-slate-50"
                  placeholder="WEB"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="project.description"
                  className="text-xs font-semibold text-slate-700"
                >
                  Description *
                </Label>
                <Textarea
                  id="project.description"
                  {...register('project.description')}
                  className={`h-32 overflow-y-auto resize-none bg-slate-50 ${errors.project?.description ? 'border-red-400' : 'border-slate-200'}`}
                  placeholder="Initial implementation phase..."
                  disabled={isPending}
                />
                {errors.project?.description && (
                  <span className="text-[11px] text-red-500">
                    {errors.project.description.message as string}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* STEP 3: REVIEW */}
          <div className={step === 3 ? 'block' : 'hidden'}>
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                  Client Organization
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500">Name</span>
                    <span className="font-medium text-slate-900">
                      {formValues.name} {formValues.code ? `(${formValues.code})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">Contact</span>
                    <span className="font-medium text-slate-900">
                      {formValues.contactName || 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">Email (Invitation)</span>
                    <span className="font-medium text-slate-900">
                      {formValues.email || 'None provided'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                  Initial Project
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500">Project Name</span>
                    <span className="font-medium text-slate-900">
                      {formValues.project?.name}{' '}
                      {formValues.project?.code ? `(${formValues.project?.code})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
                The client will receive an invitation and becomes active after accepting it. Both
                the client and project are created together.
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-end gap-3 border-t pt-6">
            {step === 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-slate-600"
              >
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="min-w-[100px] bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isPending || !canSubmit}
                className="min-w-[200px] bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Create Client & Project'
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
