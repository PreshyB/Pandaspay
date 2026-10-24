import { isValidOrderTransition, OrderStatus } from './order-status.enum';

describe('OrderStatus transitions (state-machine spec §2.2)', () => {
  it('allows the happy path: CREATED -> PREPARING -> SHIPPED -> DELIVERED', () => {
    expect(isValidOrderTransition(OrderStatus.CREATED, OrderStatus.PREPARING)).toBe(true);
    expect(isValidOrderTransition(OrderStatus.PREPARING, OrderStatus.SHIPPED)).toBe(true);
    expect(isValidOrderTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('allows skipping IN_TRANSIT when there is no live tracking integration', () => {
    expect(isValidOrderTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('allows the pre-acceptance cancellation exit', () => {
    expect(isValidOrderTransition(OrderStatus.CREATED, OrderStatus.CANCELLED)).toBe(true);
  });

  it('allows the delivery-failure retry loop', () => {
    expect(isValidOrderTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERY_FAILED)).toBe(true);
    expect(isValidOrderTransition(OrderStatus.DELIVERY_FAILED, OrderStatus.IN_TRANSIT)).toBe(true);
    expect(isValidOrderTransition(OrderStatus.DELIVERY_FAILED, OrderStatus.RETURNED)).toBe(true);
  });

  it('rejects skipping straight from CREATED to DELIVERED', () => {
    expect(isValidOrderTransition(OrderStatus.CREATED, OrderStatus.DELIVERED)).toBe(false);
  });

  it('rejects any transition out of the terminal states', () => {
    expect(isValidOrderTransition(OrderStatus.CANCELLED, OrderStatus.PREPARING)).toBe(false);
    expect(isValidOrderTransition(OrderStatus.RETURNED, OrderStatus.DELIVERED)).toBe(false);
  });

  it('only allows DELIVERED -> RETURNED (the rare post-delivery-dispute path), never buyer/seller-direct', () => {
    expect(isValidOrderTransition(OrderStatus.DELIVERED, OrderStatus.RETURNED)).toBe(true);
    expect(isValidOrderTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
  });
});
