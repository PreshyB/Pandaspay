import { sniffImageType } from './product-images.service';

describe('sniffImageType', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
  });

  it('rejects everything else, whatever the file is called', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImageType(Buffer.from('<?php echo 1;'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});
