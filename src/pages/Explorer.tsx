/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useEffect, useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Search } from "lucide-react";
import { AccountsContext } from "../accounts/AccountsContext";
import { SdkContext } from "../sdk/SdkContext";
import { u8aToHex, stringToU8a, hexToU8a, u8aToString } from "@polkadot/util";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import { Account } from "../accounts/types";

export default function ExplorerPage() {
  const { accounts, fetchPolkadotAccounts } = useContext(AccountsContext);
  const accountsArray = Array.from(accounts.values());
  const [collection, setCollection] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const { sdk } = useContext(SdkContext);
  const [nft, setNft] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [decryptedAttributes, setDecryptedAttributes] = useState<{
    [key: string]: any;
  }>({});
  const [isDecrypted, setIsDecrypted] = useState(false);

  useEffect(() => {
    if (accountsArray.length === 0) {
      fetchPolkadotAccounts();
    }
  }, [accountsArray.length, fetchPolkadotAccounts]);

  useEffect(() => {
    if (sdk && collection && tokenId) {
      fetchNFT();
    }
  }, [sdk]);

  useEffect(() => {
    if (nft) {
      const tokenData = JSON.parse(nft.properties[2].value);
      const attributes: { [key: string]: any } = {};
      tokenData.attributes.forEach(
        (attr: { trait_type: string; value: any }) => {
          attributes[attr.trait_type] = attr.value;
        }
      );
      setDecryptedAttributes(attributes);
      setIsDecrypted(false);
    }
  }, [currentAccount, nft]);

  async function fetchNFT() {
    try {
      setError(null);
      setIsLoading(true);
      const token = await sdk?.token?.get({
        collectionId: collection,
        tokenId: parseInt(tokenId),
      });

      if (token) {
        setNft(token);
        setSearchPerformed(true);
        const tokenData = JSON.parse(token.properties[2].value);
        const attributes: { [key: string]: any } = {};
        tokenData.attributes.forEach(
          (attr: { trait_type: string; value: any }) => {
            attributes[attr.trait_type] = attr.value;
          }
        );
        setDecryptedAttributes(attributes);
      } else {
        setError("Token not found.");
        setNft(null);
        setDecryptedAttributes({});
      }
    } catch (error) {
      setError("Token not found.");
      setNft(null);
      setDecryptedAttributes({});
    } finally {
      setIsLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNFT();
  };

  const handleNumberInput =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value === "" || /^\d+$/.test(value)) {
        setter(value);
      }
    };

  const handleAccountSelect = (address: string) => {
    const selectedAccount =
      accountsArray.find((account) => account.address === address) || null;
    setCurrentAccount(selectedAccount);
  };

  const signMessage = async (message: string) => {
    if (!currentAccount) return null;

    try {
      await web3Enable("my dapp");
      const injector = await web3FromAddress(currentAccount.address);

      const signRaw = injector?.signer?.signRaw;

      if (!signRaw) {
        setError("Signer not found for the selected account.");
        return null;
      }

      const { signature } = await signRaw({
        address: currentAccount.address,
        data: u8aToHex(stringToU8a(message)),
        type: "bytes",
      });

      console.log("Frontend - Signature:", signature);
      return signature;
    } catch (error) {
      console.error("Error signing message:", error);
      setError("Failed to sign message.");
      return null;
    }
  };

  const handleDecrypt = async () => {
    if (!currentAccount || !nft) return;

    setIsLoading(true);

    try {
      const signature = await signMessage("Authorize decryption");
      if (!signature) {
        setError("Signature is required for decryption.");
        setIsLoading(false);
        return;
      }

      const encryptionKey = hexToU8a(signature);
      const tokenData = JSON.parse(nft.properties[2].value);
      const newDecryptedAttributes: { [key: string]: any } = {};

      tokenData.attributes.forEach(
        (attr: { trait_type: string; value: any }) => {
          if (attr.trait_type === "Nickname") {
            const encryptedBytes = hexToU8a(attr.value);
            const decryptedBytes = encryptedBytes.slice(
              0,
              -encryptionKey.length
            );
            const decryptedValue = u8aToString(decryptedBytes);
            newDecryptedAttributes[attr.trait_type] = decryptedValue;
          } else {
            newDecryptedAttributes[attr.trait_type] = attr.value;
          }
        }
      );

      setDecryptedAttributes(newDecryptedAttributes);
      setIsDecrypted(true);
    } catch (error) {
      console.error("Error decrypting:", error);
      setError("An error occurred during decryption.");
    } finally {
      setIsLoading(false);
    }
  };

  console.log("nft", nft);
  console.log("nft?.image?.url", nft?.image?.url);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold mb-4">NFT Explorer</h1>
          <div className="flex gap-4">
            <Select
              onValueChange={handleAccountSelect}
              value={currentAccount?.address || ""}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accountsArray.map((account) => (
                  <SelectItem key={account.address} value={account.address}>
                    {account.name ? account.name : account.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="collection" className="text-sm font-medium">
                    Collection
                  </label>
                  <Input
                    id="collection"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="Enter collection number"
                    value={collection}
                    onChange={handleNumberInput(setCollection)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tokenId" className="text-sm font-medium">
                    Token ID
                  </label>
                  <Input
                    id="tokenId"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="Enter token ID number"
                    value={tokenId}
                    onChange={handleNumberInput(setTokenId)}
                  />
                </div>
              </div>
              <Button type="button" className="w-full" onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {searchPerformed && (
          <div className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="p-6 flex justify-center items-center">
                  <p className="text-muted-foreground">Loading...</p>
                </CardContent>
              </Card>
            ) : error ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-red-500">{error}</p>
                </CardContent>
              </Card>
            ) : nft ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-1/2">
                      <img
                        src={
                          nft?.image?.url ||
                          "/placeholder.svg?height=400&width=400"
                        }
                        alt={`CAR #${nft?.tokenId}`}
                        className="w-full h-auto rounded-lg shadow-lg object-cover aspect-square"
                      />
                    </div>
                    <div className="w-full md:w-1/2 space-y-6">
                      <h2 className="text-3xl font-bold">
                        CAR #{nft?.tokenId}
                      </h2>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Collection</span>
                          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                            <img
                              src={
                                nft?.collection?.image?.url ||
                                "/placeholder.svg?height=24&width=24"
                              }
                              alt={nft?.collection?.name || "Collection icon"}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <span className="text-blue-600 font-medium">
                              {nft?.collection?.name || "Unknown Collection"}
                            </span>
                            <span className="text-gray-500 text-sm">
                              ID {nft.collectionId}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xl font-semibold mb-2">Owner</span>
                          <div className="mt-1 bg-gray-100 p-2 rounded-lg">
                            <span className="font-mono text-sm break-all">
                              {nft.owner}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2">
                            Attributes
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(decryptedAttributes).map(
                              ([trait_type, value]) => (
                                <div
                                  key={trait_type}
                                  className="bg-gray-100 p-3 rounded-lg flex break-all text-center justify-center"
                                >
                                  {" "}
                                  {trait_type}: {value}{" "}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                        {nft.owner === currentAccount?.address && (
                          <Button
                            onClick={handleDecrypt}
                            disabled={isDecrypted || !currentAccount}
                            className="w-full mt-4"
                          >
                            {isDecrypted ? "Decrypted" : "Decrypt"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">No results found.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
