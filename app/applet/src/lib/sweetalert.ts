import Swal from 'sweetalert2';
import './sweetalert.css';

const VELZON_BTN = {
  primary: 'velzon-swal-btn velzon-swal-btn-primary',
  danger: 'velzon-swal-btn velzon-swal-btn-danger',
} as const;

const VELZON_ICONS = {
  delete: 'https://cdn.lordicon.com/gsqxdxog.json',
  success: 'https://cdn.lordicon.com/lupuorrc.json',
} as const;

function buildVelzonHtml(
  iconSrc: string,
  iconColors: string,
  iconSize: number,
  title: string,
  text: string
): string {
  return `
    <div class="velzon-swal-content mt-3">
      <lord-icon
        src="${iconSrc}"
        trigger="loop"
        colors="${iconColors}"
        style="width:${iconSize}px;height:${iconSize}px"
      ></lord-icon>
      <div class="mt-4 pt-2 mx-5">
        <h4>${title}</h4>
        <p class="velzon-swal-text mx-4 mb-0">${text}</p>
      </div>
    </div>
  `;
}

const velzonPopupConfig = {
  customClass: {
    popup: 'velzon-swal-popup',
  },
  buttonsStyling: false,
  showCloseButton: true,
  backdrop: true,
};

export const confirmDeleteAlert = async (
  title: string = 'Apakah Anda Yakin?',
  text: string = 'Data ini akan dihapus secara permanen dan tidak dapat dikembalikan!'
): Promise<boolean> => {
  const result = await Swal.fire({
    ...velzonPopupConfig,
    html: buildVelzonHtml(
      VELZON_ICONS.delete,
      'primary:#f7b84b,secondary:#f06548',
      100,
      title,
      text
    ),
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal',
    customClass: {
      ...velzonPopupConfig.customClass,
      confirmButton: `${VELZON_BTN.primary} me-2 mb-1`,
      cancelButton: `${VELZON_BTN.danger} mb-1`,
    },
    focusConfirm: false,
    reverseButtons: false,
  });

  return result.isConfirmed;
};

export const showSuccessAlert = (
  title: string = 'Berhasil!',
  text: string = 'Data berhasil dihapus.'
) => {
  Swal.fire({
    ...velzonPopupConfig,
    html: buildVelzonHtml(
      VELZON_ICONS.success,
      'primary:#0ab39c,secondary:#405189',
      120,
      title,
      text
    ),
    showConfirmButton: true,
    confirmButtonText: 'Tutup',
    customClass: {
      ...velzonPopupConfig.customClass,
      confirmButton: `${VELZON_BTN.primary} mb-1`,
    },
    timer: 3500,
    timerProgressBar: true,
  });
};
