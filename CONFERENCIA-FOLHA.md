# SaldoPlan v5.2.0 — Como conferir seu contracheque

1. Abra **Simulação de folha** e selecione a competência.
2. Na seção **Conferir contracheque**, selecione **Horas e minutos** (`42:46`) ou **Horas decimais** (`42,46`). Não misture os formatos.
3. Informe HE 50%, HE 100%, adicional noturno e confira os dias de descanso e divisor do DSR.
4. Em **Informar valores do contracheque oficial**, preencha as rubricas presentes na folha, ou use parte dos valores da importação já revisada. Campos vazios permanecem sem comparação.
5. Confira as diferenças (calculado menos oficial), salve o mês e utilize **Imprimir / PDF** para emitir a conferência.

**Exemplo de validação técnica, outubro/2026:** salário de R$ 5.000, 220 h mensais, 20% noturno, adiantamento R$ 2.000, DSR 4/27. As horas `42:46`, `10:40` e `9:10` resultam em líquido previsto R$ 3.600,30. As referências decimais `42,46`, `10,40`, `9,10` resultam em R$ 3.587,42. A diferença de R$ 12,88 decorre apenas dessa interpretação **dentro da fórmula do simulador**; não é prova de que as horas reais ou a folha oficial estejam incorretas.

**Privacidade:** os dados ficam no perfil financeiro atual; se o Live Sync estiver ativado, podem ser armazenados no Firestore associado à conta Google sem criptografia ponta a ponta própria. Mantenha um backup JSON independente. Nenhum PDF é enviado por este recurso.
