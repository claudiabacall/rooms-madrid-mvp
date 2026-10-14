-- Permite al propietario crear su membresia inicial.

DROP POLICY IF EXISTS "Propietario crea su membresia"
ON public.household_members;

CREATE POLICY "Propietario crea su membresia"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND role = 'owner'
  AND status = 'accepted'
  AND EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_id
      AND h.owner_id = (SELECT auth.uid())
  )
);
