/**
 * Initial demo data that gets loaded into sessionStorage on the frontend.
 * This data is returned by GET /demo/initial-data
 */
export const DEMO_INITIAL_DATA = {
  customer: {
    id: 'demo-customer-001',
    email: 'cliente-demo@higinex.com',
    name: 'Empresa Demo S.A.S',
    phone: '+57 300 123 4567',
    documentType: 'NIT',
    documentNumber: '900123456-1',
    addresses: [
      {
        id: 'demo-addr-001',
        label: 'Sede Principal',
        line1: 'Carrera 45 #26-85',
        line2: 'Edificio Centro Empresarial, Oficina 301',
        neighborhood: 'Centro',
        city: 'Bogotá',
        state: 'Cundinamarca',
        postalCode: '110111',
        isDefault: true,
      },
      {
        id: 'demo-addr-002',
        label: 'Bodega',
        line1: 'Calle 80 #100-45',
        line2: 'Zona Industrial',
        neighborhood: 'Fontibón',
        city: 'Bogotá',
        state: 'Cundinamarca',
        postalCode: '110931',
        isDefault: false,
      },
    ],
  },

  products: [
    {
      id: 'demo-prod-001',
      name: 'Jabón Líquido Industrial Premium',
      slug: 'jabon-liquido-industrial-premium',
      description:
        'Jabón líquido de alta espuma para uso industrial. Formulación concentrada con aroma fresco. Ideal para dispensadores automáticos en baños de alto tráfico.',
      status: 'PUBLISHED',
      images: [
        {
          id: 'demo-img-001',
          url: '/assets/demo/jabon-liquido.jpg',
          altText: 'Jabón Líquido Industrial Premium',
          isDefault: true,
        },
      ],
      variants: [
        {
          id: 'demo-var-001',
          sku: 'JAB-LIQ-3.8L',
          name: 'Galón 3.8L',
          isActive: true,
        },
        {
          id: 'demo-var-002',
          sku: 'JAB-LIQ-20L',
          name: 'Cuñete 20L',
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-prod-002',
      name: 'Desinfectante Multiusos Profesional',
      slug: 'desinfectante-multiusos-profesional',
      description:
        'Desinfectante de amplio espectro. Elimina 99.9% de bacterias y virus. Apto para superficies en hospitales, restaurantes y oficinas.',
      status: 'PUBLISHED',
      images: [
        {
          id: 'demo-img-002',
          url: '/assets/demo/desinfectante.jpg',
          altText: 'Desinfectante Multiusos Profesional',
          isDefault: true,
        },
      ],
      variants: [
        {
          id: 'demo-var-003',
          sku: 'DES-MUL-1L',
          name: 'Botella 1L',
          isActive: true,
        },
        {
          id: 'demo-var-004',
          sku: 'DES-MUL-5L',
          name: 'Galón 5L',
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-prod-003',
      name: 'Gel Antibacterial 70% Alcohol',
      slug: 'gel-antibacterial-70-alcohol',
      description:
        'Gel antibacterial con 70% de alcohol isopropílico. Secado rápido sin sensación pegajosa. Con vitamina E para el cuidado de las manos.',
      status: 'PUBLISHED',
      images: [
        {
          id: 'demo-img-003',
          url: '/assets/demo/gel-antibacterial.jpg',
          altText: 'Gel Antibacterial 70% Alcohol',
          isDefault: true,
        },
      ],
      variants: [
        {
          id: 'demo-var-005',
          sku: 'GEL-ANT-500ML',
          name: 'Botella 500ml',
          isActive: true,
        },
        {
          id: 'demo-var-006',
          sku: 'GEL-ANT-1L',
          name: 'Botella 1L',
          isActive: true,
        },
      ],
    },
  ],

  contracts: [
    {
      id: 'demo-contract-001',
      customerId: 'demo-customer-001',
      isActive: true,
      startsAt: new Date().toISOString(),
      endsAt: null,
      items: [
        { variantId: 'demo-var-001', unitPriceCop: 45000 },
        { variantId: 'demo-var-002', unitPriceCop: 180000 },
        { variantId: 'demo-var-003', unitPriceCop: 12000 },
        { variantId: 'demo-var-004', unitPriceCop: 48000 },
        { variantId: 'demo-var-005', unitPriceCop: 15000 },
        { variantId: 'demo-var-006', unitPriceCop: 28000 },
      ],
    },
  ],

  inventory: [
    { variantId: 'demo-var-001', onHand: 150, reserved: 0 },
    { variantId: 'demo-var-002', onHand: 50, reserved: 0 },
    { variantId: 'demo-var-003', onHand: 200, reserved: 0 },
    { variantId: 'demo-var-004', onHand: 80, reserved: 0 },
    { variantId: 'demo-var-005', onHand: 300, reserved: 0 },
    { variantId: 'demo-var-006', onHand: 120, reserved: 0 },
  ],

  orders: [],
};

export const DEMO_ACCOUNTS = {
  admin: 'admin-demo@higinex.com',
  user: 'cliente-demo@higinex.com',
} as const;

export const DEMO_PASSWORD = 'demo123';
