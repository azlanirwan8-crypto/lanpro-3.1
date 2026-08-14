/**
 * Test untuk parser impor diagram.
 *
 * Berekstensi .tsx supaya masuk proyek Jest "jsdom": parser memakai DOMParser
 * dan document.createElement, yang tidak ada di lingkungan node.
 *
 * Test ini merekam perilaku parser SEBAGAIMANA ADANYA saat dipindahkan dari
 * FlowchartContainer, bukan perilaku yang seharusnya. Nilainya adalah jaring
 * pengaman: bila Fase 4 dan 5 nanti mengubah sesuatu di sekitarnya, pergeseran
 * perilaku akan terlihat di sini.
 */
import { parseDrawIoXML, parseMiroContent, decodeHtmlEntity } from './importers';

describe('decodeHtmlEntity', () => {
  it('mengembalikan entitas HTML menjadi karakter aslinya', () => {
    expect(decodeHtmlEntity('Tim &amp; Proses')).toBe('Tim & Proses');
    expect(decodeHtmlEntity('&lt;mulai&gt;')).toBe('<mulai>');
  });

  it('membiarkan teks tanpa entitas apa adanya', () => {
    expect(decodeHtmlEntity('Verifikasi Data')).toBe('Verifikasi Data');
  });
});

describe('parseDrawIoXML', () => {
  const drawio = `
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Mulai" style="ellipse;whiteSpace=wrap" vertex="1">
          <mxGeometry x="40" y="80" width="120" height="60" />
        </mxCell>
        <mxCell id="3" value="Cek&amp;nbsp;Saldo" style="rhombus" vertex="1">
          <mxGeometry x="200" y="80" width="140" height="90" />
        </mxCell>
        <mxCell id="4" value="ya" edge="1" source="2" target="3" />
      </root>
    </mxGraphModel>`;

  it('memetakan mxCell vertex menjadi node berikut posisi dan ukurannya', () => {
    const { nodes } = parseDrawIoXML(drawio);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      id: 'drawio-2',
      label: 'Mulai',
      x: 40,
      y: 80,
      width: 120,
      height: 60,
    });
  });

  it('menerjemahkan style Draw.io menjadi tipe bentuk LanPro', () => {
    const { nodes } = parseDrawIoXML(drawio);

    expect(nodes[0].type).toBe('oval');
    expect(nodes[0].color).toBe('emerald');
    expect(nodes[1].type).toBe('diamond');
    expect(nodes[1].color).toBe('orange');
  });

  it('men-decode entitas HTML di dalam label', () => {
    const { nodes } = parseDrawIoXML(drawio);

    // &amp;nbsp; ter-decode satu tingkat menjadi &nbsp;, lalu jadi spasi keras.
    expect(nodes[1].label).toContain('Cek');
    expect(nodes[1].label).toContain('Saldo');
  });

  it('memetakan mxCell edge menjadi edge dengan label', () => {
    const { edges } = parseDrawIoXML(drawio);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      fromNodeId: 'drawio-2',
      toNodeId: 'drawio-3',
      label: 'ya',
    });
  });

  it('melewati sel rangka id 0 dan 1', () => {
    const { nodes } = parseDrawIoXML(drawio);

    expect(nodes.map((n) => n.id)).not.toContain('drawio-0');
    expect(nodes.map((n) => n.id)).not.toContain('drawio-1');
  });

  it('membuang edge yang salah satu ujungnya tidak ada nodenya', () => {
    const menggantung = `
      <mxGraphModel><root>
        <mxCell id="2" value="Mulai" vertex="1"><mxGeometry x="0" y="0" /></mxCell>
        <mxCell id="9" edge="1" source="2" target="tidak-ada" />
      </root></mxGraphModel>`;

    const { nodes, edges } = parseDrawIoXML(menggantung);

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it('memberi label pengganti bila value kosong', () => {
    const tanpaLabel = `
      <mxGraphModel><root>
        <mxCell id="2" value="" vertex="1"><mxGeometry x="0" y="0" /></mxCell>
      </root></mxGraphModel>`;

    expect(parseDrawIoXML(tanpaLabel).nodes[0].label).toBe('Komponen Alur');
  });

  it('melempar bila tidak ada satu pun mxCell', () => {
    expect(() => parseDrawIoXML('<mxGraphModel><root /></mxGraphModel>')).toThrow(
      /Tidak ditemukan elemen diagram/,
    );
  });
});

describe('parseMiroContent — CSV', () => {
  // Parser hanya membaca BARIS PERTAMA sebagai header, jadi node dan edge harus
  // berbagi satu skema kolom. Baris yang kolom from/to-nya terisi menjadi edge;
  // sisanya menjadi node.
  it('membaca baris menjadi node dan baris ber-from/to menjadi edge', () => {
    const csv = [
      'id,text,x,y,shape,from,to',
      'a,Registrasi,10,20,circle,,',
      'b,Validasi,200,20,rhombus,,',
      'e1,lolos,,,,a,b',
    ].join('\n');

    const { nodes, edges } = parseMiroContent(csv, true);

    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['miro-a', 'miro-b']));
    expect(nodes.find((n) => n.id === 'miro-a')).toMatchObject({
      label: 'Registrasi',
      x: 10,
      y: 20,
      type: 'oval',
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ fromNodeId: 'miro-a', toNodeId: 'miro-b' });
  });

  it('menghormati tanda kutip sehingga koma di dalam teks tidak memecah kolom', () => {
    const csv = ['id,text', 'a,"Cek saldo, lalu lanjut"'].join('\n');

    expect(parseMiroContent(csv, true).nodes[0].label).toBe('Cek saldo, lalu lanjut');
  });

  it('melempar bila CSV tidak punya baris data', () => {
    expect(() => parseMiroContent('id,text', true)).toThrow(/CSV kosong/);
  });
});

describe('parseMiroContent — JSON', () => {
  it('membaca widget dari kunci data', () => {
    const json = JSON.stringify({
      data: [
        { id: 's1', type: 'shape', text: 'Ambil Data', position: { x: 30, y: 40 }, shape: 'circle' },
        { id: 's2', type: 'shape', text: 'Simpan', position: { x: 300, y: 40 } },
        { id: 'c1', type: 'connector', start: { id: 's1' }, end: { id: 's2' } },
      ],
    });

    const { nodes, edges } = parseMiroContent(json, false);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ id: 'miro-s1', label: 'Ambil Data', x: 30, y: 40, type: 'oval' });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ fromNodeId: 'miro-s1', toNodeId: 'miro-s2' });
  });

  it('menerima array telanjang tanpa kunci pembungkus', () => {
    const json = JSON.stringify([{ id: 'x', text: 'Satu' }]);

    expect(parseMiroContent(json, false).nodes[0].label).toBe('Satu');
  });

  it('membersihkan tag HTML dari teks widget', () => {
    const json = JSON.stringify([{ id: 'x', text: '<p>Kirim <b>Notifikasi</b></p>' }]);

    expect(parseMiroContent(json, false).nodes[0].label).toBe('Kirim Notifikasi');
  });

  it('memberi label pengganti bila widget tidak punya teks', () => {
    const json = JSON.stringify([{ id: 'x', type: 'sticky' }]);

    expect(parseMiroContent(json, false).nodes[0].label).toBe('Miro sticky');
  });
});
