import { Injectable } from '@nestjs/common';
import {
  mcPath,
  CashPickupCitiesQuery,
  CashPickupProvidersQuery,
  CashPickupBranchesQuery,
} from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';

/**
 * Cash Pickup location catalogs (countries / cities / providers / branches).
 * GET catalogs; partner-id goes in the HEADER (not the path) — `catalogHeaders`.
 */
@Injectable()
export class CashPickupService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /** Список стран с выдачей наличных (GET, фильтр по cash_pickup_type). */
  cashPickupCountries(tenantId: string, cashPickupType?: string) {
    return this.gw.run(tenantId, 'cashPickupCountries', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup(
        'countries',
        this.gw.qs({ cash_pickup_type: cashPickupType }),
      ),
      headers: this.gw.catalogHeaders(c),
    }));
  }

  /** Города с выдачей наличных (GET, Directed). */
  cashPickupCities(tenantId: string, q: CashPickupCitiesQuery) {
    return this.gw.run(tenantId, 'cashPickupCities', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup('cities', this.gw.qs(q)),
      headers: this.gw.catalogHeaders(c),
    }));
  }

  /** Receiving Service Providers (GET). */
  cashPickupProviders(tenantId: string, q: CashPickupProvidersQuery) {
    return this.gw.run(tenantId, 'cashPickupProviders', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup('providers', this.gw.qs(q)),
      headers: this.gw.catalogHeaders(c),
    }));
  }

  /** Точки выдачи конкретного провайдера (GET). */
  cashPickupBranches(tenantId: string, q: CashPickupBranchesQuery) {
    return this.gw.run(tenantId, 'cashPickupBranches', (c) => ({
      method: 'GET',
      path: mcPath.cashPickup('branches', this.gw.qs(q)),
      headers: this.gw.catalogHeaders(c),
    }));
  }
}
