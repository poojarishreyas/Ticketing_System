'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, Send, Ticket } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProjects } from '@/hooks/use-projects';
import { apiClient } from '@/services/api/api-client';
import { ProjectWithClient } from '@/lib/project/project.types';

const ticketSchema = z.object({
  projectId: z.string().min(1, 'Choose a project'),
  title: z.string().min(5, 'Use at least 5 characters'),
  description: z.string().min(10, 'Add at least 10 characters'),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateTicketModal({ open, onOpenChange, onCreated }: CreateTicketModalProps) {
  const [step, setStep] = useState(1);
  const { data: projectsData, isLoading } = useProjects({
    page: 1,
    limit: 100,
    sort: 'createdAt',
    order: 'desc',
  });
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { projectId: '', title: '', description: '' },
  });
  const projects: ProjectWithClient[] = projectsData?.data ?? [];
  const isSubmitting = form.formState.isSubmitting;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(1);
      form.reset();
    }
    onOpenChange(nextOpen);
  };

  const nextStep = async () => {
    if (await form.trigger(['projectId', 'title'])) setStep(2);
  };

  const submit = async (values: TicketFormValues) => {
    try {
      await apiClient('/tickets', { method: 'POST', body: JSON.stringify(values) });
      toast.success('Ticket created');
      handleOpenChange(false);
      onCreated();
    } catch {
      toast.error('Failed to create ticket');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] max-w-[calc(100%-2rem)] flex-col p-0 sm:max-w-xl"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Ticket className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Create a ticket</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Tell us what you need help with.
              </DialogDescription>
            </div>
          </div>
          <div className="mt-5 flex gap-2" aria-label={`Step ${step} of 2`}>
            {[1, 2].map((item) => (
              <span
                key={item}
                className={`h-1 flex-1 rounded-full ${item <= step ? 'bg-blue-600' : 'bg-slate-100'}`}
              />
            ))}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              {step === 1 ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">What is this about?</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Choose a project and add a concise subject.
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select
                          items={projects.map((project) => ({
                            value: project.id,
                            label: project.name,
                          }))}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoading ? (
                              <div className="flex items-center gap-2 p-3 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading projects
                              </div>
                            ) : (
                              projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. Unable to access the reporting dashboard"
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add the details</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Include context, steps, and the outcome you expected.
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="min-h-40 resize-none"
                            placeholder="Describe the issue in detail..."
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-slate-100 p-6 pt-4">
              {step === 1 ? (
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft /> Back
                </Button>
              )}
              {step === 1 ? (
                <Button type="button" onClick={nextStep}>
                  Continue <ArrowRight />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating
                    </>
                  ) : (
                    <>
                      <Send />
                      Create ticket
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
