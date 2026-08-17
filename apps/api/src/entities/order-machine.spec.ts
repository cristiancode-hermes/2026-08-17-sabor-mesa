import { ORDER_TRANSITIONS, RESERVATION_TRANSITIONS, pointsForTotal } from './entities';

describe('Máquinas de estado y reglas de negocio (puras)', () => {
  it('pedido: ENVIADO → EN_COCINA → SERVIDO → COBRADO, sin saltos', () => {
    expect(ORDER_TRANSITIONS['ENVIADO']).toContain('EN_COCINA');
    expect(ORDER_TRANSITIONS['ENVIADO']).toContain('CANCELADO');
    expect(ORDER_TRANSITIONS['EN_COCINA']).toContain('SERVIDO');
    expect(ORDER_TRANSITIONS['SERVIDO']).toContain('COBRADO');
    // Transiciones inválidas
    expect(ORDER_TRANSITIONS['ENVIADO']).not.toContain('COBRADO');
    expect(ORDER_TRANSITIONS['ENVIADO']).not.toContain('SERVIDO');
    expect(ORDER_TRANSITIONS['SERVIDO']).not.toContain('CANCELADO');
    expect(ORDER_TRANSITIONS['COBRADO']).toHaveLength(0);
    expect(ORDER_TRANSITIONS['CANCELADO']).toHaveLength(0);
  });

  it('reserva: PENDIENTE → CONFIRMADA → COMPLETADA, PENDIENTE → VENCIDA/CANCELADA', () => {
    expect(RESERVATION_TRANSITIONS['PENDIENTE']).toContain('CONFIRMADA');
    expect(RESERVATION_TRANSITIONS['PENDIENTE']).toContain('CANCELADA');
    expect(RESERVATION_TRANSITIONS['PENDIENTE']).toContain('VENCIDA');
    expect(RESERVATION_TRANSITIONS['CONFIRMADA']).toContain('COMPLETADA');
    expect(RESERVATION_TRANSITIONS['CONFIRMADA']).toContain('CANCELADA');
    expect(RESERVATION_TRANSITIONS['VENCIDA']).toHaveLength(0);
  });

  it('puntos: 1 punto por cada 10 € completos (regla F: floor(total/10))', () => {
    expect(pointsForTotal(0)).toBe(0);
    expect(pointsForTotal(999)).toBe(0); // 9,99 € → 0
    expect(pointsForTotal(1000)).toBe(1); // 10,00 € → 1
    expect(pointsForTotal(1099)).toBe(1); // 10,99 € → 1
    expect(pointsForTotal(2500)).toBe(2); // 25,00 € → 2
    expect(pointsForTotal(4640)).toBe(4); // 46,40 € → 4
    expect(pointsForTotal(10000)).toBe(10);
  });
});