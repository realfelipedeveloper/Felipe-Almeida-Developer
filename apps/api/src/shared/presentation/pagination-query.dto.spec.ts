import { toPaginatedResult } from './pagination-query.dto';

describe('toPaginatedResult', () => {
  it('calcula o total de páginas', () => {
    expect(toPaginatedResult(['a', 'b'], 25, 2, 10)).toEqual({
      data: ['a', 'b'],
      pagination: {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });
});
