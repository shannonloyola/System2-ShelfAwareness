create or replace function public.get_product_association_rules(
  target_product text,
  min_support numeric default 0.05,
  min_confidence numeric default 0.3,
  max_results integer default 5
)
returns table (
  product_name text,
  support numeric,
  confidence numeric,
  co_occurrences integer,
  total_pos integer,
  target_occurrences integer
)
language sql
stable
as $$
  with filtered_orders as (
    select po_id
    from public.purchase_orders
    where coalesce(lower(trim(status)), '') not in ('draft', 'cancelled', 'rejected')
  ),
  distinct_items as (
    select distinct
      poi.po_id,
      lower(trim(poi.item_name)) as item_key,
      trim(poi.item_name) as product_name
    from public.purchase_order_items poi
    inner join filtered_orders fo on fo.po_id = poi.po_id
    where coalesce(trim(poi.item_name), '') <> ''
  ),
  basket_totals as (
    select count(distinct po_id)::integer as total_pos
    from distinct_items
  ),
  target_baskets as (
    select distinct po_id
    from distinct_items
    where item_key = lower(trim(target_product))
  ),
  target_totals as (
    select count(*)::integer as target_occurrences
    from target_baskets
  ),
  co_occurrences as (
    select
      di.item_key,
      min(di.product_name) as product_name,
      count(*)::integer as co_occurrences
    from distinct_items di
    inner join target_baskets tb on tb.po_id = di.po_id
    where di.item_key <> lower(trim(target_product))
    group by di.item_key
  )
  select
    co.product_name,
    round((co.co_occurrences::numeric / nullif(bt.total_pos, 0)), 4) as support,
    round((co.co_occurrences::numeric / nullif(tt.target_occurrences, 0)), 4) as confidence,
    co.co_occurrences,
    bt.total_pos,
    tt.target_occurrences
  from co_occurrences co
  cross join basket_totals bt
  cross join target_totals tt
  where (co.co_occurrences::numeric / nullif(bt.total_pos, 0)) >= min_support
    and (co.co_occurrences::numeric / nullif(tt.target_occurrences, 0)) >= min_confidence
  order by confidence desc, support desc, co.co_occurrences desc, co.product_name asc
  limit greatest(max_results, 1);
$$;
