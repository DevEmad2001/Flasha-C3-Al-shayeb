-- Reverse stock when an inventory movement is deleted
CREATE OR REPLACE FUNCTION public.reverse_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.movement_type = 'in' THEN
    UPDATE public.inventory_items SET quantity = quantity - OLD.quantity, updated_at = now() WHERE id = OLD.item_id;
  ELSE
    UPDATE public.inventory_items SET quantity = quantity + OLD.quantity, updated_at = now() WHERE id = OLD.item_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_reverse_inventory_movement
BEFORE DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.reverse_inventory_movement();

-- Ensure the apply trigger exists (idempotent re-create)
DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- Handle updates: reverse old effect then apply new effect
CREATE OR REPLACE FUNCTION public.update_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Reverse old
  IF OLD.movement_type = 'in' THEN
    UPDATE public.inventory_items SET quantity = quantity - OLD.quantity WHERE id = OLD.item_id;
  ELSE
    UPDATE public.inventory_items SET quantity = quantity + OLD.quantity WHERE id = OLD.item_id;
  END IF;
  -- Apply new
  IF NEW.movement_type = 'in' THEN
    UPDATE public.inventory_items SET quantity = quantity + NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSE
    UPDATE public.inventory_items SET quantity = quantity - NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_update_inventory_movement
AFTER UPDATE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.update_inventory_movement();