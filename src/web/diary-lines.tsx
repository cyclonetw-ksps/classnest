// 作業、要帶、備註三行；空的不顯示
export function DiaryLines({ homework, bring, note }: { homework: string; bring: string; note: string }) {
  return (
    <dl class="diary-lines">
      {homework && (
        <div>
          <dt>
            <span class="due">作業</span>
          </dt>
          <dd>{homework}</dd>
        </div>
      )}
      {bring && (
        <div>
          <dt>要帶</dt>
          <dd>{bring}</dd>
        </div>
      )}
      {note && (
        <div>
          <dt>備註</dt>
          <dd>{note}</dd>
        </div>
      )}
    </dl>
  );
}
