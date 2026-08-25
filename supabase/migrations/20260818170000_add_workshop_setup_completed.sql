-- Confectu: añadir indicador de onboarding completado a profiles
-- Marca si un usuario CLIENT ya finalizó la configuración inicial de su taller.

alter table public.profiles
  add column workshop_setup_completed boolean not null default false;

comment on column public.profiles.workshop_setup_completed is 'Indica si el usuario CLIENT ya completó el onboarding de su taller.';
