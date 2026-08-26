"use client";

import Image from "next/image";
import { type KeyboardEvent, useRef, useState } from "react";
import {
  cardSets,
  getCardSetDisplayDescription,
  getCardSetDisplayLabel,
  getCardSetSourceLabel,
} from "@/data/card-sets";
import type { AppLocale } from "@/i18n/locale";
import { getCardCount, type Messages } from "@/i18n/messages";
import type { CardDefinition, CardSetDefinition } from "@/types";

type DeckChooserProps = {
  activeCardSetId: string;
  locale: AppLocale;
  messages: Messages;
  onChoose: (cardSetId: string) => void;
};

const PREVIEW_CARD_COUNT = 3;

export function getNextDeckIndex(
  key: string,
  currentIndex: number,
  deckCount: number
): number | null {
  if (deckCount === 0) {
    return null;
  }

  if (key === "ArrowDown" || key === "ArrowRight") {
    return (currentIndex + 1) % deckCount;
  }

  if (key === "ArrowUp" || key === "ArrowLeft") {
    return (currentIndex - 1 + deckCount) % deckCount;
  }

  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return deckCount - 1;
  }

  return null;
}

function getDeckPreviewCards(cardSet: CardSetDefinition): CardDefinition[] {
  if (cardSet.cards.length <= PREVIEW_CARD_COUNT) {
    return cardSet.cards;
  }

  const previewIndexes = [
    0,
    Math.floor(cardSet.cards.length / 2),
    cardSet.cards.length - 1,
  ];

  return previewIndexes.map((index) => cardSet.cards[index]);
}

export function DeckChooser({
  activeCardSetId,
  locale,
  messages,
  onChoose,
}: DeckChooserProps) {
  const [previewedCardSetId, setPreviewedCardSetId] = useState(
    activeCardSetId
  );
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previewedCardSet =
    cardSets.find((cardSet) => cardSet.id === previewedCardSetId) ??
    cardSets[0];

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const nextIndex = getNextDeckIndex(
      event.key,
      currentIndex,
      cardSets.length
    );

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    setPreviewedCardSetId(cardSets[nextIndex].id);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="tarot-deck-chooser">
      <div className="tarot-deck-chooser-heading">
        <p className="tarot-deck-chooser-title">{messages.chooseDeck}</p>
        <p className="tarot-deck-chooser-hint">{messages.chooseDeckHint}</p>
      </div>

      <div
        className="tarot-deck-chooser-list"
        role="list"
        aria-label={messages.chooseDeck}
      >
        {cardSets.map((cardSet, index) => {
          const isCurrent = cardSet.id === activeCardSetId;
          const isPreviewed = cardSet.id === previewedCardSetId;
          const displayLabel = getCardSetDisplayLabel(cardSet, locale);
          const cardCount = getCardCount(locale, cardSet.cards.length);

          return (
            <div
              className="tarot-deck-chooser-item"
              role="listitem"
              key={cardSet.id}
            >
              <button
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                className="tarot-deck-chooser-option"
                data-deck-current={isCurrent || undefined}
                data-deck-previewed={isPreviewed || undefined}
                aria-current={isCurrent ? "true" : undefined}
                aria-describedby={`deck-chooser-${cardSet.id}-meta`}
                onFocus={() => setPreviewedCardSetId(cardSet.id)}
                onPointerEnter={() => setPreviewedCardSetId(cardSet.id)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => onChoose(cardSet.id)}
              >
                <span
                  className="tarot-deck-chooser-thumbnails"
                  aria-hidden="true"
                >
                  {getDeckPreviewCards(cardSet).map((card) => (
                    <span
                      className="tarot-deck-chooser-thumbnail"
                      key={card.id}
                    >
                      <Image
                        src={card.image.preview}
                        alt=""
                        fill
                        sizes="54px"
                      />
                    </span>
                  ))}
                </span>
                <span className="tarot-deck-chooser-option-copy">
                  <span className="tarot-deck-chooser-option-title">
                    {displayLabel}
                  </span>
                  <span
                    className="tarot-deck-chooser-option-meta"
                    id={`deck-chooser-${cardSet.id}-meta`}
                  >
                    {messages.deckKinds[cardSet.kind]} ·{" "}
                    {messages.cardsInDeck(cardCount)}
                  </span>
                </span>
                {isCurrent && (
                  <span
                    className="tarot-deck-chooser-current"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <section
        className="tarot-deck-chooser-preview"
        aria-labelledby="tarot-deck-chooser-preview-title"
        aria-live="polite"
      >
        <p className="tarot-deck-chooser-preview-label">
          {previewedCardSet.id === activeCardSetId
            ? messages.currentDeck
            : messages.deck}
        </p>
        <h2 id="tarot-deck-chooser-preview-title">
          {getCardSetDisplayLabel(previewedCardSet, locale)}
        </h2>
        <p className="tarot-deck-chooser-description">
          {getCardSetDisplayDescription(previewedCardSet, locale)}
        </p>

        <div className="tarot-deck-chooser-sources">
          <span>{messages.sources}</span>
          <ul>
            {previewedCardSet.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noreferrer">
                  {getCardSetSourceLabel(source, locale)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
